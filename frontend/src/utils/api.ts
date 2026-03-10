const API_URL = 'http://localhost:8787/api';

export interface Article {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export const api = {
  // Public
  getPublishedArticles: async (): Promise<Article[]> => {
    const res = await fetch(`${API_URL}/articles`);
    if (!res.ok) throw new Error('Failed to fetch articles');
    return res.json();
  },
  
  //SINGLE ARTICLE HOME
  getArticleDetails: async (idOrSlug: string): Promise<Article> => {
    const res = await fetch(`${API_URL}/articles/${idOrSlug}`);
    if (!res.ok) throw new Error('Article not found');
    return res.json();
  },

  // Admin
  getAllArticles: async (): Promise<Article[]> => {
    const res = await fetch(`${API_URL}/admin/articles`);
    if (!res.ok) throw new Error('Failed to fetch all articles');
    return res.json();
  },
  
  getStats: async (): Promise<{ total: number, published: number, drafts: number }> => {
    const res = await fetch(`${API_URL}/admin/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },
  
  createArticle: async (data: Partial<Article>): Promise<Article> => {
    const res = await fetch(`${API_URL}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to create article');
    }
    return res.json();
  },
  
  updateArticle: async (id: string, data: Partial<Article>): Promise<Article> => {
    const res = await fetch(`${API_URL}/articles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to update article');
    }
    return res.json();
  },
  
  deleteArticle: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/admin/articles/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete article');
  },
  
  togglePublish: async (id: string, published: boolean): Promise<Article> => {
    const res = await fetch(`${API_URL}/admin/articles/${id}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published }),
    });
    if (!res.ok) throw new Error('Failed to update publish status');
    return res.json();
  }
};
