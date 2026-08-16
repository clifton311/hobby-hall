// Data layer for Hobby Hall.
// If Supabase env vars are set (.env), everything is real: password auth,
// shared database, photo storage. Otherwise the app runs in "demo mode"
// using localStorage (per-browser data, name-only login).

import { supabase, isConfigured } from './supabaseClient';

export const usingSupabase = isConfigured;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1200;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('read failed')); };
    img.src = url;
  });

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

// ---------------------------------------------------------------------------
// Supabase backend
// ---------------------------------------------------------------------------

const sb = {
  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return null;
    return { id: profile.id, name: profile.name, bio: profile.bio, joined: profile.created_at };
  },

  onAuthChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event) => callback(event));
    return () => data.subscription.unsubscribe();
  },

  async signUp({ email, password, name, bio }) {
    // Reserve the display name check first for a friendlier error.
    const { data: taken } = await supabase.from('profiles').select('id').eq('name', name).maybeSingle();
    if (taken) throw new Error('That display name is taken — try another.');

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) {
      throw new Error('Check your email to confirm your account, then log in. (You can disable email confirmation in Supabase → Authentication → Providers → Email.)');
    }
    const { error: pErr } = await supabase.from('profiles')
      .insert({ id: data.user.id, name, bio: bio || '' });
    if (pErr) throw pErr;
  },

  async signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signOut() { await supabase.auth.signOut(); },

  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async listPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(name), comments(id, text, created_at, profiles(name)), likes(user_id)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      name: p.profiles?.name || 'unknown',
      category: p.category,
      title: p.title,
      body: p.body,
      image: p.image_url,
      ts: new Date(p.created_at).getTime(),
      likedByIds: (p.likes || []).map((l) => l.user_id),
      comments: (p.comments || [])
        .map((c) => ({ id: c.id, name: c.profiles?.name || 'unknown', text: c.text, ts: new Date(c.created_at).getTime() }))
        .sort((a, b) => a.ts - b.ts),
    }));
  },

  async createPost(user, { category, title, body, imageFile }) {
    let image_url = null;
    if (imageFile) {
      const blob = await compressImage(imageFile);
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('photos')
        .upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      image_url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from('posts')
      .insert({ user_id: user.id, category, title, body, image_url });
    if (error) throw error;
  },

  async setLike(user, postId, liked) {
    if (liked) {
      const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: user.id });
      if (error && error.code !== '23505') throw error; // ignore duplicate
    } else {
      const { error } = await supabase.from('likes')
        .delete().eq('post_id', postId).eq('user_id', user.id);
      if (error) throw error;
    }
  },

  async addComment(user, postId, text) {
    const { error } = await supabase.from('comments')
      .insert({ post_id: postId, user_id: user.id, text });
    if (error) throw error;
  },

  async getProfile(name) {
    const { data } = await supabase.from('profiles')
      .select('name, bio, created_at').eq('name', name).maybeSingle();
    return data ? { name: data.name, bio: data.bio, joined: new Date(data.created_at).getTime() } : null;
  },
};

// ---------------------------------------------------------------------------
// Demo backend (localStorage, per-browser) — used when Supabase isn't set up
// ---------------------------------------------------------------------------

const lsGet = (k, fallback) => {
  try { const v = localStorage.getItem('hh:' + k); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const lsSet = (k, v) => { try { localStorage.setItem('hh:' + k, JSON.stringify(v)); } catch {} };

const SEED = [
  { id: 'seed_1', userId: 'demo_maya', name: 'Maya', category: 'fiber', title: 'First hand-dyed skein with avocado pits', body: 'Saved pits and skins for a month — got this dusty pink on merino. The trick is a long, slow simmer and patience. Ask me anything about natural dyes!', image: null, ts: Date.now() - 172800000, likedByIds: ['demo_theo'], comments: [{ id: 'c1', name: 'Theo', text: 'That color is gorgeous. How long did you simmer?', ts: Date.now() - 86400000 }] },
  { id: 'seed_2', userId: 'demo_theo', name: 'Theo', category: 'wood', title: 'Dovetail practice box, attempt #4', body: 'Finally got gaps under half a millimeter. Sharp chisels changed everything — I was fighting dull tools for three attempts.', image: null, ts: Date.now() - 86400000, likedByIds: [], comments: [] },
  { id: 'seed_3', userId: 'demo_priya', name: 'Priya', category: 'garden', title: 'Balcony tomatoes are officially out of control', body: "Three plants in grow bags, and I'm harvesting a bowl a day. Happy to share my watering schedule for hot climates.", image: null, ts: Date.now() - 18000000, likedByIds: ['demo_maya'], comments: [{ id: 'c2', name: 'Maya', text: 'Yes please, mine keep wilting by noon!', ts: Date.now() - 7200000 }] },
];

const demo = {
  async getCurrentUser() { return lsGet('me', null); },
  onAuthChange() { return () => {}; },

  async signUp({ name, bio }) { return demo.demoSignIn({ name, bio }); },
  async signIn({ name }) { return demo.demoSignIn({ name }); },
  async demoSignIn({ name, bio = '' }) {
    const profiles = lsGet('profiles', {});
    const id = 'demo_' + name.toLowerCase().replace(/\W+/g, '_');
    if (!profiles[name]) profiles[name] = { bio, joined: Date.now() };
    else if (bio) profiles[name].bio = bio;
    lsSet('profiles', profiles);
    const me = { id, name, bio: profiles[name].bio, joined: profiles[name].joined };
    lsSet('me', me);
    return me;
  },
  async signOut() { try { localStorage.removeItem('hh:me'); } catch {} },

  async requestPasswordReset() { throw new Error('Password reset needs Supabase configured — demo mode has no real passwords.'); },
  async updatePassword() { throw new Error('Password reset needs Supabase configured — demo mode has no real passwords.'); },

  async listPosts() {
    let posts = lsGet('posts', null);
    if (!posts) { posts = SEED; lsSet('posts', posts); }
    return [...posts].sort((a, b) => b.ts - a.ts);
  },

  async createPost(user, { category, title, body, imageFile }) {
    let image = null;
    if (imageFile) image = await blobToDataUrl(await compressImage(imageFile));
    const posts = await demo.listPosts();
    posts.unshift({ id: 'p_' + Date.now(), userId: user.id, name: user.name, category, title, body, image, ts: Date.now(), likedByIds: [], comments: [] });
    lsSet('posts', posts);
  },

  async setLike(user, postId, liked) {
    const posts = await demo.listPosts();
    const p = posts.find((x) => x.id === postId);
    if (!p) return;
    p.likedByIds = liked
      ? [...new Set([...(p.likedByIds || []), user.id])]
      : (p.likedByIds || []).filter((id) => id !== user.id);
    lsSet('posts', posts);
  },

  async addComment(user, postId, text) {
    const posts = await demo.listPosts();
    const p = posts.find((x) => x.id === postId);
    if (!p) return;
    p.comments = [...(p.comments || []), { id: 'c_' + Date.now(), name: user.name, text, ts: Date.now() }];
    lsSet('posts', posts);
  },

  async getProfile(name) {
    const profiles = lsGet('profiles', {});
    const seedBios = { Maya: 'Natural dyes and slow craft.', Theo: 'Hand-tool woodworking.', Priya: 'Balcony farmer.' };
    if (profiles[name]) return { name, bio: profiles[name].bio, joined: profiles[name].joined };
    if (seedBios[name]) return { name, bio: seedBios[name], joined: Date.now() - 2592000000 };
    return null;
  },
};

export const api = usingSupabase ? sb : demo;
