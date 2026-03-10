import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  KV: KVNamespace;
};

// Article structure strictly from requirements
interface Article {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

const app = new Hono<{ Bindings: Bindings }>();

// Add CORS so frontend can communicate with backend
app.use('/*', cors());

// Helper function to fetch all articles from KV
async function getAllArticles(kv: KVNamespace): Promise<Article[]> {
  const list = await kv.list({ prefix: 'article:' });
  const articles: Article[] = [];
  
  // Fetch values for each key in parallel
  await Promise.all(
    list.keys.map(async (key) => {
      const article = await kv.get<Article>(key.name, 'json');
      if (article) articles.push(article);
    })
  );
  
  // Sort by newest first
  return articles.sort((a, b) => b.createdAt - a.createdAt);
}

// Simple health check endpoint
app.get('/', (c) => {
  return c.text('Knowledge Base API is running!');
});

// ---------------------------------------------------------
// PUBLIC API ENDPOINTS
// ---------------------------------------------------------

// GET /api/articles - List PUBLISHED articles-HOME
app.get('/api/articles', async (c) => {
  const allArticles = await getAllArticles(c.env.KV);
  
  // Filter for only published articles
  const publishedArticles = allArticles.filter(a => a.published === true);
  return c.json(publishedArticles);
});

//SINGLE ARTICLE DETAILS
// GET /api/articles/:id - Article details
app.get('/api/articles/:id', async (c) => {
  const idOrSlug = c.req.param('id');
  
  // We first try to treat 'id' as an actual UUID
  let article = await c.env.KV.get<Article>(`article:${idOrSlug}`, 'json');
  
  // If not found, fall back to checking if they passed a "slug" (helpful for Astro frontend!)
  if (!article) {
    const allArticles = await getAllArticles(c.env.KV);
    article = allArticles.find(a => a.slug === idOrSlug) || null;
  }

  // Error Handling: article not found
  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }
  
  return c.json(article);
});

// ---------------------------------------------------------
// ADMIN API ENDPOINTS
// ---------------------------------------------------------

// POST /api/articles - Create article
app.post('/api/articles', async (c) => {
  try {
    const body = await c.req.json();
    const { title, category, content } = body;

    // Validation Rules
    if (!title) return c.json({ error: 'invalid request: title is required' }, 400);
    if (!category) return c.json({ error: 'invalid request: category is required' }, 400);
    if (!content || content.length < 50) return c.json({ error: 'invalid request: content minimum 50 characters' }, 400);

    // Generate slug from title (e.g., "Hello World!" -> "hello-world")
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // Error Handling: Duplicate Slug
    const allArticles = await getAllArticles(c.env.KV);
    if (allArticles.some(a => a.slug === slug)) {
      return c.json({ error: 'duplicate slug: An article with a similar title already exists' }, 400);
    }

    // Article structure fulfillment
    const newArticle: Article = {
      id: crypto.randomUUID(),
      slug,
      title,
      category,
      content,
      published: false, // Default to draft/unpublish
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Store in KV database
    await c.env.KV.put(`article:${newArticle.id}`, JSON.stringify(newArticle));

    return c.json(newArticle, 201);
  } catch (error) {
    return c.json({ error: 'invalid request format' }, 400);
  }
});

// PUT /api/articles/:id - Update article
app.put('/api/articles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Check if article exists
    const existing = await c.env.KV.get<Article>(`article:${id}`, 'json');
    if (!existing) return c.json({ error: 'article not found' }, 404);

    // Validate rules if they are trying to update specific fields
    if (body.title === "") return c.json({ error: 'invalid request: title cannot be empty' }, 400);
    if (body.category === "") return c.json({ error: 'invalid request: category cannot be empty' }, 400);
    if (body.content && body.content.length < 50) return c.json({ error: 'invalid request: content minimum 50 characters' }, 400);

    // Construct the updated article
    const updatedArticle: Article = {
      ...existing,
      ...body,     // override existing fields with new body fields
      id: existing.id, // don't override the primary ID
      updatedAt: Date.now()
    };

    // Save back to KV
    await c.env.KV.put(`article:${id}`, JSON.stringify(updatedArticle));

    return c.json(updatedArticle);
  } catch (error) {
    return c.json({ error: 'invalid request format' }, 400);
  }
});

// DELETE /api/admin/articles/:id - Delete article
app.delete('/api/admin/articles/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.KV.get<Article>(`article:${id}`, 'json');
  
  if (!existing) return c.json({ error: 'article not found' }, 404);
  
  await c.env.KV.delete(`article:${id}`);
  
  return c.json({ message: 'Deleted successfully' });
});

// PATCH /api/admin/articles/:id/publish - Publish or unpublish
app.patch('/api/admin/articles/:id/publish', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    if (typeof body.published !== 'boolean') {
        return c.json({ error: 'invalid request: published explicitly requires true or false' }, 400);
    }

    const existing = await c.env.KV.get<Article>(`article:${id}`, 'json');
    if (!existing) return c.json({ error: 'article not found' }, 404);

    // Toggle publish field
    existing.published = body.published;
    existing.updatedAt = Date.now();

    await c.env.KV.put(`article:${id}`, JSON.stringify(existing));

    return c.json(existing);
  } catch (error) {
    return c.json({ error: 'invalid request format' }, 400);
  }
});

// GET /api/admin/articles - List all articles-ADMIN
app.get('/api/admin/articles', async (c) => {
  const allArticles = await getAllArticles(c.env.KV);
  return c.json(allArticles);
});

// GET /api/admin/stats - Article statistics
app.get('/api/admin/stats', async (c) => {
  const allArticles = await getAllArticles(c.env.KV);
  
  const total = allArticles.length;
  const published = allArticles.filter(a => a.published).length;
  const drafts = total - published; // the remaining count as drafts

  return c.json({
    total,
    published,
    drafts
  });
});

export default app;
