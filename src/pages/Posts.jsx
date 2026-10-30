import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const MAX_MEDIA_FILES = 5;
const MAX_MEDIA_SIZE_MB = 50;
const ACCEPTED_MEDIA = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime';

// Uploaded files are served by the API, not the frontend dev server
const mediaSrc = (url) => `${api.defaults.baseURL}${url}`;

function CreatePostModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]); // { file, url, isVideo }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Revoke preview object URLs when the modal unmounts
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    setError('');
    const next = [...files];
    for (const file of picked) {
      if (next.length >= MAX_MEDIA_FILES) {
        setError(`Maximum ${MAX_MEDIA_FILES} files per post`);
        break;
      }
      if (file.size > MAX_MEDIA_SIZE_MB * 1024 * 1024) {
        setError(`${file.name} exceeds ${MAX_MEDIA_SIZE_MB}MB`);
        continue;
      }
      next.push({
        file,
        url: URL.createObjectURL(file),
        isVideo: file.type.startsWith('video/'),
      });
    }
    setFiles(next);
  };

  const removeFile = (index) => {
    URL.revokeObjectURL(files[index].url);
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      files.forEach((f) => form.append('media', f.file));
      await api.post('/posts', form);
      onCreated();
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Could not create post');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[2rem] bg-surface-container-lowest shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[22px]">post_add</span>
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-on-surface">Create New Post</h3>
              <p className="text-xs text-on-surface-variant">Share something with the community</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 px-8 pb-2">
            {error && <p className="rounded-xl bg-error-container px-4 py-2.5 text-sm text-error">{error}</p>}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center justify-between text-sm font-semibold text-on-surface" htmlFor="post-title">
                Post Title
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Required</span>
              </label>
              <input
                id="post-title"
                type="text"
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter post title..."
                className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-[0_0_0_3px_rgba(67,56,202,0.15)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface" htmlFor="post-description">
                Description
              </label>
              <textarea
                id="post-description"
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write your post description..."
                className="w-full resize-none rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-[0_0_0_3px_rgba(67,56,202,0.15)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center justify-between text-sm font-semibold text-on-surface">
                Photos & Videos
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Optional</span>
              </label>
              {files.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {files.map((f, i) => (
                    <div key={f.url} className="relative aspect-square overflow-hidden rounded-xl bg-surface-container-low">
                      {f.isVideo ? (
                        <video src={f.url} muted className="h-full w-full object-cover" />
                      ) : (
                        <img src={f.url} alt="" className="h-full w-full object-cover" />
                      )}
                      {f.isVideo && (
                        <span className="material-symbols-outlined pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[22px] text-white drop-shadow">
                          play_circle
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        title="Remove"
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-on-surface/70 text-white transition-colors hover:bg-error"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {files.length < MAX_MEDIA_FILES && (
                <label
                  htmlFor="post-media"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low px-4 py-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                  Add photos or videos ({files.length}/{MAX_MEDIA_FILES})
                </label>
              )}
              <input id="post-media" type="file" multiple accept={ACCEPTED_MEDIA} onChange={addFiles} className="hidden" />
              <p className="text-[11px] text-outline">
                JPEG, PNG, GIF, WebP, MP4, WebM, MOV — up to {MAX_MEDIA_SIZE_MB}
                MB each
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-end gap-3 bg-surface-container-low px-8 py-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-surface-container-lowest px-6 py-2.5 text-sm font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.98] disabled:opacity-70"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              {saving ? 'Creating...' : 'Create Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PostDetailsModal({ post, isAdmin, onClose, onLike, onCommentAdded }) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [error, setError] = useState('');
  const [currentPost, setCurrentPost] = useState(post);

  const submitComment = async (e) => {
    e.preventDefault();
    const content = comment.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/posts/${post.id}/comments`, {
        content,
      });
      const added = {
        id: data.id,
        content: data.content,
        createdAt: data.createdAt,
        author: data.user,
      };
      setCurrentPost((current) => ({
        ...current,
        comments: [...current.comments, added],
      }));
      setComment('');
      onCommentAdded(post.id);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Could not add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async () => {
    if (isAdmin || liking) return;
    setLiking(true);
    setError('');
    try {
      const result = await onLike(currentPost);
      setCurrentPost((current) => ({
        ...current,
        likedByMe: result.liked,
        likeCount: result.likeCount,
      }));
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Could not update like');
    } finally {
      setLiking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-details-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl md:flex-row"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-outline-variant/30 px-5 py-4">
            <h2 id="post-details-title" className="font-heading text-lg font-bold text-on-surface">
              Post & comments
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close post details"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-on-primary">
                {currentPost.author.avatarUrl ? (
                  <img src={mediaSrc(currentPost.author.avatarUrl)} alt={currentPost.author.name} className="h-full w-full object-cover" />
                ) : (
                  currentPost.author.name[0]?.toUpperCase()
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">{currentPost.author.name}</p>
                <p className="text-xs text-on-surface-variant">{new Date(currentPost.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <h3 className="font-heading text-xl font-bold text-on-surface">{currentPost.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">{currentPost.description}</p>

            {currentPost.status !== 'active' && (
              <div className="mt-4 rounded-xl bg-error-container/70 px-4 py-3 text-sm text-error">
                <p className="font-semibold">
                  {currentPost.status === 'hidden' ? 'This post is hidden.' : 'This post is restricted.'}
                </p>
                {currentPost.moderationReason && <p className="mt-1">Reason: {currentPost.moderationReason}</p>}
                {currentPost.status === 'restricted' && (
                  <p className="mt-1">Likes and comments are disabled while the restriction is active.</p>
                )}
              </div>
            )}

            {currentPost.media?.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {currentPost.media.map((media) => (
                  <div key={media.id} className="overflow-hidden rounded-xl bg-surface-container-low">
                    {media.type === 'video' ? (
                      <video src={mediaSrc(media.url)} controls preload="metadata" className="max-h-80 w-full object-contain" />
                    ) : (
                      <img src={mediaSrc(media.url)} alt="" className="max-h-80 w-full object-contain" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-error-container px-3 py-2 text-sm text-error">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between border-y border-outline-variant/30 py-3">
              <button
                type="button"
                onClick={toggleLike}
                disabled={isAdmin || liking || currentPost.status !== 'active'}
                aria-label={currentPost.likedByMe ? 'Unlike post' : 'Like post'}
                className={`flex items-center gap-2 text-sm font-semibold ${
                  currentPost.likedByMe ? 'text-error' : 'text-on-surface-variant'
                } ${isAdmin ? 'cursor-default' : 'cursor-pointer hover:text-error'}`}
              >
                <span className={`material-symbols-outlined ${currentPost.likedByMe ? 'icon-filled' : ''}`}>favorite</span>
                {currentPost.likeCount} likes
              </button>
              <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                {currentPost.views} views
              </span>
            </div>

            <div className="pt-4">
              <h3 className="mb-3 text-sm font-bold text-on-surface">Comments ({currentPost.comments.length})</h3>
              {currentPost.comments.length === 0 ? (
                <p className="py-6 text-center text-sm text-on-surface-variant">No comments yet. Start the conversation.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {currentPost.comments.map((item) => (
                    <article key={item.id} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-xs font-bold text-primary">
                        {item.author?.avatarUrl ? (
                          <img src={mediaSrc(item.author.avatarUrl)} alt={item.author.name} className="h-full w-full object-cover" />
                        ) : (
                          item.author?.name?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div className="min-w-0 flex-1 rounded-2xl bg-surface-container-low px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="text-xs font-bold text-on-surface">{item.author?.name || 'Former member'}</span>
                          <time className="text-[10px] text-on-surface-variant">{new Date(item.createdAt).toLocaleString()}</time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-on-surface-variant">{item.content}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!isAdmin && currentPost.status === 'active' && (
            <form onSubmit={submitComment} className="flex items-end gap-2 border-t border-outline-variant/30 p-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={1}
                aria-label="Write a comment"
                placeholder="Add a comment..."
                className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={!comment.trim() || submitting}
                className="cursor-pointer rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState('all'); // all | mine
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('latest'); // latest | liked | viewed
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [moderatingPost, setModeratingPost] = useState(null);
  const [moderationStatus, setModerationStatus] = useState('restricted');
  const [moderationReason, setModerationReason] = useState('');
  const [moderationError, setModerationError] = useState('');
  const [moderationSaving, setModerationSaving] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const fetchPosts = async () => {
    try {
      const { data } = await api.get('/posts');
      setPosts(data);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Could not load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const myCount = useMemo(() => posts.filter((p) => p.isMine).length, [posts]);

  // Feed is already loaded, so filter + sort stay client-side
  // (the Users page shows the server-side variant of search)
  const visible = useMemo(() => {
    let list = tab === 'mine' ? posts.filter((p) => p.isMine) : [...posts];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.author.name.toLowerCase().includes(q),
      );
    }

    if (sort === 'liked') list.sort((a, b) => b.likeCount - a.likeCount);
    else if (sort === 'viewed') list.sort((a, b) => b.views - a.views);
    else list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return list;
  }, [posts, tab, search, sort]);

  const toggleLike = async (post) => {
    // Optimistic update, then sync with the server response
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likeCount: p.likeCount + (p.likedByMe ? -1 : 1),
            }
          : p,
      ),
    );
    try {
      const { data } = await api.post(`/posts/${post.id}/like`);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likedByMe: data.liked, likeCount: data.likeCount } : p)));
      return data;
    } catch {
      await fetchPosts();
      throw new Error('Could not update like');
    }
  };

  const openPostDetails = async (post) => {
    setSelectedPost(post);
    setDetailsLoading(true);
    setDetailsError('');
    try {
      const { data } = await api.get(`/posts/${post.id}`);
      setSelectedPost(data);
      setPosts((prev) =>
        prev.map((item) =>
          item.id === data.id
            ? {
                ...item,
                views: data.views,
                likeCount: data.likeCount,
                likedByMe: data.likedByMe,
                commentCount: data.comments.length,
              }
            : item,
        ),
      );
    } catch (err) {
      const msg = err.response?.data?.message;
      setDetailsError(Array.isArray(msg) ? msg[0] : msg || 'Could not load post details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const deletePost = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${id}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Could not delete post');
    }
  };

  const openModeration = (post, status) => {
    setModeratingPost(post);
    setModerationStatus(status);
    setModerationReason('');
    setModerationError('');
  };

  const saveModeration = async (e) => {
    e.preventDefault();
    if (!moderatingPost || moderationSaving) return;
    setModerationSaving(true);
    setModerationError('');
    try {
      await api.patch(`/posts/${moderatingPost.id}/moderation`, {
        status: moderationStatus,
        ...(moderationStatus !== 'active' ? { reason: moderationReason.trim() } : {}),
      });
      setModeratingPost(null);
      if (selectedPost?.id === moderatingPost.id) setSelectedPost(null);
      await fetchPosts();
    } catch (err) {
      const msg = err.response?.data?.message;
      setModerationError(Array.isArray(msg) ? msg[0] : msg || 'Could not update post status');
    } finally {
      setModerationSaving(false);
    }
  };

  const tabClass = (active) =>
    `flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
      active
        ? 'bg-primary-container text-on-primary shadow-sm'
        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
    }`;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-surface/95 pb-3 pt-2 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-96 w-96 rounded-full bg-primary-fixed/40 blur-3xl" />
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex max-w-2xl flex-col">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Content Stream
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              <span className="text-xs font-medium text-secondary">Live Feed</span>
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-on-surface">Community Posts</h1>
            <p className="mt-1.5 text-sm text-on-surface-variant">
              {isAdmin
                ? 'Moderate community content — remove anything inappropriate.'
                : 'Discover updates and announcements across ConnectHub.'}
            </p>
          </div>
          {!isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="group inline-flex cursor-pointer items-center gap-2 self-start rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-container hover:shadow-xl hover:shadow-primary/30 md:self-auto"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:rotate-90">add</span>
              New Post
            </button>
          )}
        </div>

        {/* Tabs */}
        {!isAdmin && (
          <div className="flex items-center gap-2 pb-2">
            <button onClick={() => setTab('all')} className={tabClass(tab === 'all')}>
              All Posts
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  tab === 'all' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {posts.length}
              </span>
            </button>
            <button onClick={() => setTab('mine')} className={tabClass(tab === 'mine')}>
              My Posts
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  tab === 'mine' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {myCount}
              </span>
            </button>
          </div>
        )}
        {/* Search + sort toolbar */}
        <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts by title, content or author..."
              className="h-11 w-full rounded-xl bg-surface-container-low pl-11 pr-4 text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant focus:bg-surface-container-high"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-surface-container-low px-3 py-1.5">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="cursor-pointer bg-transparent py-1.5 text-xs font-semibold text-on-surface outline-none"
            >
              <option value="latest">Latest First</option>
              <option value="liked">Most Liked</option>
              <option value="viewed">Most Viewed</option>
            </select>
          </div>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl bg-error-container px-4 py-2.5 text-sm text-error">{error}</p>}

      {/* Feed */}
      {loading ? (
        <p className="py-20 text-center text-sm text-on-surface-variant">Loading posts...</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-container-lowest py-20 shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-outline-variant">dynamic_feed</span>
          <p className="text-sm text-on-surface-variant">
            {search || tab === 'mine'
              ? 'No posts match — try a different search or tab.'
              : `No posts yet${isAdmin ? '.' : ' — be the first to publish!'}`}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((post) => (
              <article
                key={post.id}
                className="group flex flex-col rounded-3xl bg-surface-container-lowest p-6 shadow-sm transition-all duration-300 hover:shadow-md"
              >
                <div className="flex flex-col">
                  {/* Badges row */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    {post.isMine ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-[10px] font-bold tracking-wide text-primary">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                        My Post
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
                        Community
                      </span>
                    )}
                    {post.status !== 'active' && (
                      <span className="rounded-full bg-error-container px-2.5 py-1 text-[10px] font-bold capitalize text-error">
                        {post.status}
                      </span>
                    )}
                    {post.isMine && !isAdmin && (
                      <button
                        onClick={() => deletePost(post.id)}
                        title="Delete post"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-error"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {post.status !== 'active' ? (
                          <button
                            type="button"
                            onClick={() => openModeration(post, 'active')}
                            className="cursor-pointer rounded-full bg-secondary-container px-3 py-1.5 text-xs font-semibold text-secondary"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openModeration(post, 'restricted')}
                              className="cursor-pointer rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface-variant"
                            >
                              Restrict
                            </button>
                            <button
                              type="button"
                              onClick={() => openModeration(post, 'hidden')}
                              className="cursor-pointer rounded-full bg-error-container px-3 py-1.5 text-xs font-semibold text-error"
                            >
                              Hide
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <button
                    type="button"
                    onClick={() => openPostDetails(post)}
                    className="mb-2 line-clamp-1 cursor-pointer text-left font-heading text-lg font-bold tracking-tight text-on-surface transition-colors group-hover:text-primary"
                  >
                    {post.title}
                  </button>
                  <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{post.description}</p>
                  {post.status !== 'active' && post.moderationReason && (post.isMine || isAdmin) && (
                    <p className="mb-4 rounded-xl bg-error-container/70 px-3 py-2 text-xs text-error">
                      Moderation reason: {post.moderationReason}
                    </p>
                  )}

                  {post.media?.length > 0 && (
                    <div
                      className={`mb-4 grid gap-1.5 overflow-hidden rounded-2xl ${post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
                    >
                      {post.media.slice(0, 4).map((m, i) => (
                        <div key={m.id} className="relative aspect-video overflow-hidden bg-surface-container-low">
                          {m.type === 'video' ? (
                            <video src={mediaSrc(m.url)} controls preload="metadata" className="h-full w-full object-cover" />
                          ) : (
                            <img src={mediaSrc(m.url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                          {i === 3 && post.media.length > 4 && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-on-surface/50 text-lg font-bold text-white">
                              +{post.media.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Author + metrics footer */}
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-on-primary shadow-sm">
                      {post.author.avatarUrl ? (
                        <img src={mediaSrc(post.author.avatarUrl)} alt={post.author.name} className="h-full w-full object-cover" />
                      ) : (
                        post.author.name[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-on-surface">{post.author.name}</span>
                        {post.isMine && (
                          <span className="rounded-full bg-secondary-container px-1.5 py-0.5 text-[9px] font-bold text-secondary">You</span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        {new Date(post.createdAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-surface-container-low/60 px-3 py-2">
                    <button
                      onClick={() => !isAdmin && toggleLike(post).catch((err) => setError(err.message))}
                      disabled={isAdmin || post.status !== 'active'}
                      className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${
                        post.likedByMe ? 'text-error' : 'text-on-surface-variant'
                      } ${isAdmin || post.status !== 'active' ? 'cursor-default' : 'cursor-pointer hover:text-error active:scale-110'}`}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${post.likedByMe ? 'icon-filled' : ''}`}>favorite</span>
                      {post.likeCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPostDetails(post)}
                      className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:text-primary"
                      aria-label={`View ${post.commentCount || 0} comments`}
                    >
                      <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                      {post.commentCount || 0}
                    </button>
                    <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                      {post.views}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-on-surface-variant">
            Showing {visible.length} of {posts.length} posts
          </p>
        </>
      )}

      {showModal && (
        <CreatePostModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            fetchPosts();
          }}
        />
      )}
      {moderatingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveModeration}
            className="w-full max-w-lg rounded-3xl bg-surface-container-lowest p-6 shadow-2xl"
          >
            <h2 className="font-heading text-xl font-bold text-on-surface">
              {moderationStatus === 'active'
                ? 'Restore post'
                : moderationStatus === 'hidden'
                  ? 'Hide post'
                  : 'Restrict post'}
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              <span className="font-semibold">{moderatingPost.title}</span>
              {moderationStatus === 'hidden'
                ? ' will be removed from the community feed. The author can still see it.'
                : moderationStatus === 'restricted'
                  ? ' will remain visible, but users cannot like or comment.'
                  : ' will return to the community feed with interactions enabled.'}
            </p>
            {moderationStatus !== 'active' && (
              <label className="mt-5 block text-sm font-semibold text-on-surface" htmlFor="moderation-reason">
                Reason (required)
                <textarea
                  id="moderation-reason"
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  maxLength={1000}
                  minLength={1}
                  required
                  rows={4}
                  placeholder="Explain why this post is being moderated..."
                  className="mt-2 w-full resize-y rounded-xl bg-surface-container-low p-3 text-sm font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            )}
            {moderationError && (
              <p role="alert" className="mt-3 rounded-xl bg-error-container px-3 py-2 text-sm text-error">
                {moderationError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModeratingPost(null)}
                disabled={moderationSaving}
                className="cursor-pointer rounded-full bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={moderationSaving || (moderationStatus !== 'active' && !moderationReason.trim())}
                className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {moderationSaving ? 'Saving…' : moderationStatus === 'active' ? 'Restore post' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}
      {selectedPost &&
        (detailsLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 p-4">
            <div className="rounded-2xl bg-surface-container-lowest px-8 py-6 text-sm text-on-surface-variant shadow-xl">Loading post…</div>
          </div>
        ) : detailsError ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 p-4">
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface-container-lowest p-6 text-center shadow-xl">
              <p role="alert" className="text-sm text-error">
                {detailsError}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => openPostDetails(selectedPost)}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : (
          <PostDetailsModal
            post={selectedPost}
            isAdmin={isAdmin}
            onClose={() => setSelectedPost(null)}
            onLike={toggleLike}
            onCommentAdded={(postId) =>
              setPosts((prev) => prev.map((item) => (item.id === postId ? { ...item, commentCount: (item.commentCount || 0) + 1 } : item)))
            }
          />
        ))}
    </div>
  );
}
