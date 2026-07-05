import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Plus, X, Compass, MessageCircle, ImageIcon, LogOut, User, ArrowLeft } from "lucide-react";
import { api, usingSupabase } from "./api";

const CATEGORIES = [
  { id: "fiber", label: "Fiber & Textile", emoji: "🧶", hue: "#B54A32" },
  { id: "wood", label: "Woodworking", emoji: "🪚", hue: "#8A6240" },
  { id: "food", label: "Cooking & Baking", emoji: "🥖", hue: "#C98A1B" },
  { id: "art", label: "Art & Illustration", emoji: "🎨", hue: "#4A5FB5" },
  { id: "garden", label: "Gardening", emoji: "🌱", hue: "#2E7D4F" },
  { id: "music", label: "Music", emoji: "🎻", hue: "#7B4AB5" },
  { id: "maker", label: "Tech & Making", emoji: "🔧", hue: "#3A7C8C" },
  { id: "outdoor", label: "Outdoors", emoji: "⛰️", hue: "#5B7043" },
];

const cat = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
const ago = (ts) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [posts, setPosts] = useState(null);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState({ page: "feed" });
  const [profileInfo, setProfileInfo] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "fiber", title: "", body: "", imageFile: null, preview: null });
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [auth, setAuth] = useState({ email: "", password: "", name: "", bio: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const refreshUser = useCallback(async () => {
    try { setUser(await api.getCurrentUser()); } catch { setUser(null); }
  }, []);

  const refreshPosts = useCallback(async () => {
    try { setPosts(await api.listPosts()); }
    catch (e) { console.error("load posts failed", e); setPosts([]); }
  }, []);

  useEffect(() => {
    refreshUser();
    refreshPosts();
    return api.onAuthChange(refreshUser);
  }, [refreshUser, refreshPosts]);

  useEffect(() => {
    if (view.page === "profile") {
      setProfileInfo(null);
      api.getProfile(view.name).then(setProfileInfo).catch(() => setProfileInfo(null));
    }
  }, [view]);

  // ---------- auth ----------
  const submitAuth = async () => {
    setAuthError("");
    setAuthBusy(true);
    try {
      if (usingSupabase) {
        if (authMode === "signup") {
          if (!auth.email || !auth.password || !auth.name.trim()) throw new Error("Email, password, and display name are required.");
          if (auth.password.length < 6) throw new Error("Password must be at least 6 characters.");
          await api.signUp({ email: auth.email, password: auth.password, name: auth.name.trim(), bio: auth.bio.trim() });
        } else {
          await api.signIn({ email: auth.email, password: auth.password });
        }
      } else {
        if (!auth.name.trim()) throw new Error("Enter a name to continue.");
        await api.demoSignIn({ name: auth.name.trim(), bio: auth.bio.trim() });
      }
      await refreshUser();
      setAuth({ email: "", password: "", name: "", bio: "" });
    } catch (e) {
      setAuthError(e.message || "Something went wrong — try again.");
    }
    setAuthBusy(false);
  };

  const logout = async () => {
    await api.signOut();
    setUser(null);
    setView({ page: "feed" });
  };

  // ---------- actions ----------
  const submitPost = async () => {
    if (!user || !form.title.trim()) return;
    setSaving(true);
    try {
      await api.createPost(user, {
        category: form.category,
        title: form.title.trim(),
        body: form.body.trim(),
        imageFile: form.imageFile,
      });
      await refreshPosts();
      setForm({ category: "fiber", title: "", body: "", imageFile: null, preview: null });
      setShowForm(false);
    } catch (e) {
      alert("Couldn't post: " + (e.message || "unknown error"));
    }
    setSaving(false);
  };

  const toggleLike = async (p) => {
    if (!user) return;
    const liked = p.likedByIds.includes(user.id);
    setPosts((ps) => ps.map((x) => x.id === p.id
      ? { ...x, likedByIds: liked ? x.likedByIds.filter((i) => i !== user.id) : [...x.likedByIds, user.id] }
      : x));
    try { await api.setLike(user, p.id, !liked); } catch { refreshPosts(); }
  };

  const addComment = async (p) => {
    if (!user) return;
    const text = (commentDrafts[p.id] || "").trim();
    if (!text) return;
    setCommentDrafts({ ...commentDrafts, [p.id]: "" });
    try { await api.addComment(user, p.id, text); await refreshPosts(); }
    catch (e) { alert("Couldn't comment: " + (e.message || "unknown error")); }
  };

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, imageFile: file, preview: URL.createObjectURL(file) }));
    e.target.value = "";
  };

  // ---------- derived ----------
  const shown = posts === null ? null
    : view.page === "profile" ? posts.filter((p) => p.name === view.name)
    : filter === "all" ? posts
    : posts.filter((p) => p.category === filter);

  const openProfile = (name) => { setView({ page: "profile", name }); window.scrollTo(0, 0); };

  // ---------- render ----------
  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F1", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E2823" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .hh-card { transition: transform .15s ease, box-shadow .15s ease; }
        .hh-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(30,40,35,.10); }
        button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid #2E7D4F; outline-offset: 2px; }
        .hh-name:hover { text-decoration: underline; }
        @media (prefers-reduced-motion: reduce) { .hh-card { transition: none; } }
      `}</style>

      {/* Header */}
      <header style={{ background: "#1E3A2F", color: "#F2F4F1", padding: "22px 20px 18px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <button onClick={() => setView({ page: "feed" })} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <Compass size={22} strokeWidth={2.2} style={{ color: "#E0A62B" }} />
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 25, letterSpacing: "-0.01em" }}>Hobby Hall</span>
            </button>
            <p style={{ margin: "5px 0 0", fontSize: 13.5, opacity: 0.85 }}>A commons for creators — show what you're making.</p>
          </div>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => openProfile(user.name)} title="Your profile"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.12)", border: "none", borderRadius: 999, padding: "7px 12px", color: "#F2F4F1", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                <User size={15} /> {user.name}
              </button>
              <button onClick={logout} title="Log out" aria-label="Log out"
                style={{ background: "rgba(255,255,255,.12)", border: "none", borderRadius: 999, padding: 8, color: "#F2F4F1", cursor: "pointer", display: "flex" }}>
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Demo-mode banner */}
      {!usingSupabase && (
        <div style={{ background: "#FDF3DC", borderBottom: "1px solid #EBD9A8", padding: "8px 16px", textAlign: "center", fontSize: 12.5, color: "#6B5A1E" }}>
          Demo mode — data stays in this browser only. Add your Supabase keys to <code>.env</code> to go live (see README).
        </div>
      )}

      {/* Auth card */}
      {user === null && (
        <div style={{ maxWidth: 720, margin: "16px auto 0", padding: "0 16px" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E7E2", borderRadius: 14, padding: 18 }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: "0 0 4px" }}>
              {usingSupabase ? (authMode === "signup" ? "Create your account" : "Welcome back") : "Join the hall"}
            </h2>
            <p style={{ fontSize: 13, color: "#6B776F", margin: "0 0 12px" }}>
              {usingSupabase
                ? "Log in to post, comment, and like. Your display name and bio are public."
                : "Pick a name to try the demo. Your profile is visible on this browser."}
            </p>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              {usingSupabase && (
                <>
                  <input style={{ ...inp, marginBottom: 0 }} type="email" placeholder="Email" autoComplete="email"
                    value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} />
                  <input style={{ ...inp, marginBottom: 0 }} type="password" placeholder="Password"
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && submitAuth()} />
                </>
              )}
              {(authMode === "signup" || !usingSupabase) && (
                <>
                  <input style={{ ...inp, marginBottom: 0 }} placeholder="Display name" maxLength={40}
                    value={auth.name} onChange={(e) => setAuth({ ...auth, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && submitAuth()} />
                  <input style={{ ...inp, marginBottom: 0 }} placeholder="One-line bio (optional)" maxLength={120}
                    value={auth.bio} onChange={(e) => setAuth({ ...auth, bio: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && submitAuth()} />
                </>
              )}
            </div>

            {authError && <p style={{ color: "#B54A32", fontSize: 13, margin: "10px 0 0" }}>{authError}</p>}

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={submitAuth} disabled={authBusy}
                style={{ background: "#1E3A2F", color: "#F2F4F1", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: authBusy ? 0.6 : 1 }}>
                {authBusy ? "One moment…" : usingSupabase ? (authMode === "signup" ? "Create account" : "Log in") : "Enter the hall"}
              </button>
              {usingSupabase && (
                <button onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#2E7D4F", fontSize: 13, fontWeight: 600, padding: 0 }}>
                  {authMode === "signup" ? "Have an account? Log in" : "New here? Create an account"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile header */}
      {view.page === "profile" && (
        <div style={{ maxWidth: 720, margin: "16px auto 0", padding: "0 16px" }}>
          <button onClick={() => setView({ page: "feed" })}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#2E7D4F", fontSize: 13.5, fontWeight: 600, padding: 0, marginBottom: 10 }}>
            <ArrowLeft size={15} /> Back to the hall
          </button>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E7E2", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#1E3A2F", color: "#E0A62B", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                {view.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>{view.name}</h2>
                <p style={{ fontSize: 13, color: "#6B776F", margin: "2px 0 0" }}>
                  {profileInfo?.bio || "No bio yet."}
                  {profileInfo?.joined ? ` · Joined ${new Date(profileInfo.joined).toLocaleDateString()}` : ""}
                </p>
              </div>
            </div>
            {shown && (
              <p style={{ fontSize: 12.5, color: "#6B776F", margin: "12px 0 0" }}>
                {shown.length} post{shown.length === 1 ? "" : "s"} · {shown.reduce((s, p) => s + p.likedByIds.length, 0)} likes received
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      {view.page === "feed" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 0", display: "flex", gap: 8, overflowX: "auto" }}>
          {[{ id: "all", label: "All", emoji: "✳️" }, ...CATEGORIES].map((c) => (
            <button key={c.id} onClick={() => setFilter(c.id)}
              style={{
                border: "1px solid " + (filter === c.id ? "#1E3A2F" : "#CBD3CC"),
                background: filter === c.id ? "#1E3A2F" : "#FFFFFF",
                color: filter === c.id ? "#F2F4F1" : "#1E2823",
                borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0,
              }}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 110px" }}>
        {shown === null && <p style={{ textAlign: "center", color: "#6B776F", padding: 40 }}>Loading the hall…</p>}
        {shown && shown.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#6B776F" }}>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 8, color: "#1E2823" }}>Nothing here yet</p>
            <p style={{ fontSize: 14 }}>{view.page === "profile" ? "This creator hasn't posted yet." : "Be the first to share something in this corner of the hall."}</p>
          </div>
        )}
        {shown && shown.map((p) => {
          const c = cat(p.category);
          const isLiked = user && p.likedByIds.includes(user.id);
          const open = openComments[p.id];
          return (
            <article key={p.id} className="hh-card"
              style={{ background: "#FFFFFF", borderRadius: 14, padding: "18px 18px 12px", marginBottom: 14, border: "1px solid #E2E7E2", borderLeft: `4px solid ${c.hue}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: "50%", background: c.hue + "1A", border: `1.5px solid ${c.hue}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{c.emoji}</span>
                <div>
                  <button className="hh-name" onClick={() => openProfile(p.name)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1E2823" }}>
                    {p.name}
                  </button>
                  <div style={{ fontSize: 12, color: "#6B776F" }}>{c.label} · {ago(p.ts)}</div>
                </div>
              </div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.25 }}>{p.title}</h2>
              {p.body && <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: "0 0 10px", color: "#3A4540" }}>{p.body}</p>}
              {p.image && (
                <img src={p.image} alt={p.title} loading="lazy"
                  style={{ width: "100%", borderRadius: 10, marginBottom: 10, border: "1px solid #E2E7E2", display: "block" }} />
              )}

              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <button onClick={() => toggleLike(p)} disabled={!user}
                  aria-label={isLiked ? "Remove like" : "Like this post"}
                  title={user ? "" : "Log in to like"}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: user ? "pointer" : "default", color: isLiked ? "#B54A32" : "#6B776F", fontSize: 13, fontWeight: 500, padding: "6px 0", opacity: user ? 1 : 0.6 }}>
                  <Heart size={17} fill={isLiked ? "#B54A32" : "none"} strokeWidth={2} /> {p.likedByIds.length}
                </button>
                <button onClick={() => setOpenComments({ ...openComments, [p.id]: !open })}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#6B776F", fontSize: 13, fontWeight: 500, padding: "6px 0" }}>
                  <MessageCircle size={17} strokeWidth={2} /> {p.comments.length}
                </button>
              </div>

              {open && (
                <div style={{ borderTop: "1px solid #EDF0ED", marginTop: 4, paddingTop: 10 }}>
                  {p.comments.map((cm) => (
                    <div key={cm.id} style={{ marginBottom: 10 }}>
                      <button className="hh-name" onClick={() => openProfile(cm.name)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#1E2823" }}>{cm.name}</button>
                      <span style={{ fontSize: 11.5, color: "#9AA49D", marginLeft: 6 }}>{ago(cm.ts)}</span>
                      <p style={{ fontSize: 13.5, margin: "2px 0 0", color: "#3A4540", lineHeight: 1.45 }}>{cm.text}</p>
                    </div>
                  ))}
                  {user ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input style={{ ...inp, marginBottom: 0, flex: 1 }} placeholder="Add a comment…" maxLength={500}
                        value={commentDrafts[p.id] || ""}
                        onChange={(e) => setCommentDrafts({ ...commentDrafts, [p.id]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && addComment(p)} />
                      <button onClick={() => addComment(p)} disabled={!(commentDrafts[p.id] || "").trim()}
                        style={{ background: "#1E3A2F", color: "#F2F4F1", border: "none", borderRadius: 9, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: (commentDrafts[p.id] || "").trim() ? 1 : 0.5 }}>
                        Post
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12.5, color: "#9AA49D", margin: 0 }}>Log in to join the conversation.</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </main>

      {/* Floating share button */}
      {user && (
        <button onClick={() => setShowForm(true)} aria-label="Share a hobby"
          style={{ position: "fixed", right: 20, bottom: 24, background: "#E0A62B", color: "#1E2823", border: "none", borderRadius: 999, padding: "14px 20px", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 6px 20px rgba(30,58,47,.25)", cursor: "pointer", zIndex: 40 }}>
          <Plus size={18} strokeWidth={2.5} /> Share
        </button>
      )}

      {/* Post form */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,28,24,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
          onClick={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#FFFFFF", width: "100%", maxWidth: 560, borderRadius: "18px 18px 0 0", padding: "22px 20px 28px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 21, margin: 0 }}>Share your hobby</h2>
              <button onClick={() => setShowForm(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#6B776F" }}><X size={20} /></button>
            </div>

            <label style={lbl}>Category</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setForm({ ...form, category: c.id })}
                  style={{ border: "1px solid " + (form.category === c.id ? c.hue : "#CBD3CC"), background: form.category === c.id ? c.hue + "1A" : "#FFF", color: "#1E2823", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>

            <label style={lbl}>Title</label>
            <input style={inp} value={form.title} maxLength={120} placeholder="What are you making or learning?"
              onChange={(e) => setForm({ ...form, title: e.target.value })} />

            <label style={lbl}>Tell the story (optional)</label>
            <textarea style={{ ...inp, minHeight: 90, resize: "vertical" }} value={form.body} maxLength={2000}
              placeholder="Process, lessons, tips for others…"
              onChange={(e) => setForm({ ...form, body: e.target.value })} />

            <label style={lbl}>Photo (optional)</label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickImage} />
            {form.preview ? (
              <div style={{ position: "relative", marginBottom: 14 }}>
                <img src={form.preview} alt="Preview" style={{ width: "100%", borderRadius: 10, border: "1px solid #E2E7E2", display: "block" }} />
                <button onClick={() => setForm({ ...form, imageFile: null, preview: null })} aria-label="Remove photo"
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(30,40,35,.75)", color: "#FFF", border: "none", borderRadius: 999, padding: 6, cursor: "pointer", display: "flex" }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center", border: "1.5px dashed #CBD3CC", background: "#FAFBFA", borderRadius: 10, padding: "14px", fontSize: 13.5, color: "#6B776F", cursor: "pointer", marginBottom: 14 }}>
                <ImageIcon size={16} /> Add a photo
              </button>
            )}

            <button onClick={submitPost} disabled={saving || !form.title.trim()}
              style={{ width: "100%", background: "#1E3A2F", color: "#F2F4F1", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: saving || !form.title.trim() ? 0.5 : 1 }}>
              {saving ? "Posting…" : "Post to the hall"}
            </button>
            <p style={{ fontSize: 11.5, color: "#6B776F", marginTop: 10, textAlign: "center" }}>
              Posts, photos, comments, and profiles are public to everyone on this site.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "#3A4540" };
const inp = {
  width: "100%", border: "1px solid #CBD3CC", borderRadius: 9,
  padding: "10px 12px", fontSize: 14, marginBottom: 14, fontFamily: "inherit", background: "#FAFBFA",
};
