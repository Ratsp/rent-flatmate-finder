// Central API client — thin fetch wrapper around the backend REST API.
// REST calls are proxied to the backend via Vite (see vite.config.js).

const TOKEN_KEY = 'rff_token';
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Perform a JSON request. Throws an Error with the server message on failure.
 */
async function request(method, path, body, isForm = false) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (isForm) {
    payload = body; // FormData — let the browser set Content-Type
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers,
    body: payload,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }

  if (!res.ok) {
    const msg = data?.details?.join(', ') || data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

const buildQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const api = {
  // Auth
  register: (body) => request('POST', '/auth/register', body),
  login: (body) => request('POST', '/auth/login', body),
  me: () => request('GET', '/auth/me'),

  // Tenant profile
  getProfile: () => request('GET', '/tenants/me'),
  saveProfile: (body) => request('PUT', '/tenants/me', body),

  // Listings
  browseListings: (params) => request('GET', `/listings${buildQuery(params)}`),
  getListing: (id) => request('GET', `/listings/${id}`),
  myListings: () => request('GET', '/listings/mine'),
  createListing: (body) => request('POST', '/listings', body),
  updateListing: (id, body) => request('PUT', `/listings/${id}`, body),
  deleteListing: (id) => request('DELETE', `/listings/${id}`),
  fillListing: (id) => request('PATCH', `/listings/${id}/fill`),
  listingInterests: (id) => request('GET', `/listings/${id}/interests`),

  // Uploads (owner)
  uploadPhotos: (formData) => request('POST', '/uploads', formData, true),

  // Interests
  sendInterest: (listing_id) => request('POST', '/interests', { listing_id }),
  myInterests: () => request('GET', '/interests/mine'),
  respondInterest: (id, status) => request('PATCH', `/interests/${id}`, { status }),

  // Chat
  chatRooms: () => request('GET', '/chat/rooms'),
  chatMessages: (id) => request('GET', `/chat/${id}/messages`),

  // Admin
  adminStats: () => request('GET', '/admin/stats'),
  adminUsers: (params) => request('GET', `/admin/users${buildQuery(params)}`),
  adminToggleUser: (id, is_active) => request('PATCH', `/admin/users/${id}`, { is_active }),
  adminListings: (params) => request('GET', `/admin/listings${buildQuery(params)}`),
  adminDeleteListing: (id) => request('DELETE', `/admin/listings/${id}`),
  adminInterests: (params) => request('GET', `/admin/interests${buildQuery(params)}`),
};
