(() => {
  'use strict';

  const SUPABASE_URL = 'https://zneqhxmimzxtgtdvtbth.supabase.co';
  const FUNCTION_URL = SUPABASE_URL + '/functions/v1/smart-responder';
  const PUBLISHABLE_KEY = 'sb_publishable_gxMn0tcrwcDyg4QDiqIB7Q_RJJTrrNt';
  const STORAGE_KEY = 'ietsh-community-visitor-v1';

  const root = document.getElementById('community-section');
  if (!root) return;

  let panelOpen = false;

  const state = {
    visitor: null,
    feed: { likes: [], comments: [], like_count: 0 },
    busy: false
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const request = async (payload) => {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': PUBLISHABLE_KEY,
        'Authorization': 'Bearer ' + PUBLISHABLE_KEY
      },
      body: JSON.stringify(payload)
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ').');
    return data;
  };

  const getSavedVisitor = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };

  const saveVisitor = (visitor) => {
    state.visitor = visitor;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visitor)); } catch (_) {}
  };

  const visitorName = (row) => {
    const visitor = row && row.visitors;
    if (Array.isArray(visitor)) return visitor[0] && visitor[0].display_name || 'Visitor';
    return visitor && visitor.display_name || 'Visitor';
  };

  const setMessage = (message, isError = false) => {
    const node = root.querySelector('.community-message');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', Boolean(isError));
  };

  const render = () => {
    root.innerHTML = '';
    root.classList.toggle('community-panel-open', panelOpen);

    const toggle = el('button', 'community-side-toggle', panelOpen ? '×' : '♥');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(panelOpen));
    toggle.setAttribute('aria-label', panelOpen ? 'Close comments panel' : 'Like and comment');
    toggle.addEventListener('click', () => {
      panelOpen = !panelOpen;
      render();
    });
    root.append(toggle);

    const shell = el('div', 'community-shell');
    const intro = el('div', 'community-intro');
    intro.append(el('h2', 'community-title', 'Like & comment'));
    shell.append(intro);

    const main = el('div', 'community-main');
    const support = el('div', 'community-support-card');
    

    const count = el('div', 'community-like-count', String(state.feed.like_count || 0));
    count.setAttribute('aria-live', 'polite');
    support.append(count);
    support.append(el('div', 'community-count-label', Number(state.feed.like_count || 0) === 1 ? 'like' : 'likes'));

    const liked = Boolean(state.visitor && state.feed.likes.some(item => item.visitor_id === state.visitor.visitor_id));
    const likeButton = el('button', 'community-like-button' + (liked ? ' is-liked' : ''), liked ? '♥  Liked' : '♥  Like this archive');
    likeButton.type = 'button';
    likeButton.disabled = !state.visitor || liked || state.busy;
    likeButton.addEventListener('click', async () => {
      if (!state.visitor || state.busy || liked) return;
      state.busy = true;
      render();
      try {
        await request({ action: 'like', visitor_id: state.visitor.visitor_id, token: state.visitor.token });
        await loadFeed();
        setMessage('Thanks for the like!');
      } catch (error) {
        setMessage(error.message, true);
      } finally {
        state.busy = false;
        render();
      }
    });
    support.append(likeButton);

    const names = el('div', 'community-liker-names');
    const likerNames = [...new Set(state.feed.likes.map(visitorName))];
    if (likerNames.length) {
      names.textContent = likerNames.join(', ');
    } else {
      names.textContent = 'Be the first to like this archive.';
    }
    support.append(names);

    if (state.visitor) {
      const profile = el('div', 'community-profile');
      profile.append(el('span', 'community-profile-name', 'You’re appearing as ' + state.visitor.display_name));
      if (!state.visitor.name_change_used) {
        const rename = el('button', 'community-text-button', 'Change name');
        rename.type = 'button';
        rename.addEventListener('click', () => renderRenameForm(profile));
        profile.append(rename);
      } else {
        profile.append(el('span', 'community-name-locked', 'Name change used'));
      }
      support.append(profile);
    } else {
      const nameForm = el('form', 'community-name-form');
      nameForm.append(el('label', '', 'Choose a display name'));
      const input = el('input', 'community-input');
      input.type = 'text';
      input.name = 'display_name';
      input.placeholder = 'Your name (1–32 characters)';
      input.maxLength = 32;
      input.required = true;
      input.autocomplete = 'nickname';
      const submit = el('button', 'community-submit-button', 'Join the community');
      submit.type = 'submit';
      nameForm.append(input, submit);
      nameForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        submit.disabled = true;
        setMessage('Creating your community name…');
        try {
          const result = await request({ action: 'init', name });
          saveVisitor({ visitor_id: result.visitor_id, token: result.token, display_name: name, name_change_used: false });
          await loadFeed();
          render();
          setMessage('You can now leave a comment.');
        } catch (error) {
          setMessage(error.message, true);
          submit.disabled = false;
        }
      });
      support.append(nameForm);
    }
    main.append(support);

    const comments = el('div', 'community-comments-card');
    const commentsHead = el('div', 'community-comments-head');
    const heading = el('div');
    heading.append(el('h3', 'community-comments-title', 'Comments'));
    commentsHead.append(heading);
    commentsHead.append(el('span', 'community-comment-count', String(state.feed.comments.length)));
    comments.append(commentsHead);

    if (state.visitor) {
      const commentForm = el('form', 'community-comment-form');
      const textarea = el('textarea', 'community-textarea');
      textarea.name = 'comment';
      textarea.placeholder = 'Write a comment…';
      textarea.maxLength = 1000;
      textarea.required = true;
      textarea.rows = 3;
      const formBottom = el('div', 'community-form-bottom');
      formBottom.append(el('span', 'community-character-hint', 'Up to 1,000 characters'));
      const submitComment = el('button', 'community-submit-button', 'Post comment');
      submitComment.type = 'submit';
      submitComment.disabled = state.busy;
      formBottom.append(submitComment);
      commentForm.append(textarea, formBottom);
      commentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = textarea.value.trim();
        if (!body || state.busy) return;
        state.busy = true;
        submitComment.disabled = true;
        try {
          await request({ action: 'comment', visitor_id: state.visitor.visitor_id, token: state.visitor.token, body });
          await loadFeed();
          state.busy = false;
          render();
          setMessage('Your comment has been posted.');
        } catch (error) {
          state.busy = false;
          render();
          setMessage(error.message, true);
        }
      });
      comments.append(commentForm);
    } else {
      comments.append(el('p', 'community-login-hint', 'Choose a display name above to join the conversation.'));
    }

    const list = el('div', 'community-comment-list');
    if (!state.feed.comments.length) {
      list.append(el('p', 'community-empty-comments', 'No comments yet. Start the conversation!'));
    } else {
      state.feed.comments.forEach(item => {
        const comment = el('article', 'community-comment');
        const meta = el('div', 'community-comment-meta');
        meta.append(el('strong', 'community-comment-author', visitorName(item)));
        const date = new Date(item.created_at);
        meta.append(el('time', 'community-comment-date', Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })));
        comment.append(meta);
        comment.append(el('p', 'community-comment-body', item.body));
        list.append(comment);
      });
    }
    comments.append(list);
    main.append(comments);
    shell.append(main);
    shell.append(el('p', 'community-message', ''));
    root.append(shell);
  };

  const renderRenameForm = (container) => {
    container.innerHTML = '';
    const form = el('form', 'community-rename-form');
    const input = el('input', 'community-input');
    input.type = 'text';
    input.value = state.visitor.display_name;
    input.maxLength = 32;
    input.required = true;
    input.setAttribute('aria-label', 'New display name');
    const save = el('button', 'community-text-button', 'Save name');
    save.type = 'submit';
    const cancel = el('button', 'community-text-button', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', render);
    form.append(input, save, cancel);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name || !state.visitor) return;
      save.disabled = true;
      try {
        const result = await request({ action: 'rename', visitor_id: state.visitor.visitor_id, token: state.visitor.token, name });
        saveVisitor({ ...state.visitor, display_name: result.visitor.display_name, name_change_used: true });
        await loadFeed();
        render();
        setMessage('Your display name has been changed.');
      } catch (error) {
        setMessage(error.message, true);
        save.disabled = false;
      }
    });
    container.append(form);
    input.focus();
  };

  async function loadFeed() {
    const data = await request({ action: 'feed' });
    state.feed = {
      likes: Array.isArray(data.likes) ? data.likes : [],
      comments: Array.isArray(data.comments) ? data.comments : [],
      like_count: Number(data.like_count || 0)
    };
  }

  const init = async () => {
    const saved = getSavedVisitor();
    if (saved && saved.visitor_id && saved.token) state.visitor = saved;
    render();
    try {
      await loadFeed();
      render();
    } catch (error) {
      setMessage('Could not load the community right now. Please refresh later.', true);
      console.error('Community feed error:', error);
    }
  };

  init();
})();
