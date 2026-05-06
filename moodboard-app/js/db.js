/* ═══════════════════════════════════════════
   DB.js — Dual mode
   · Supabase (PostgreSQL + Storage) cuando está configurado
   · IndexedDB local como fallback para desarrollo
═══════════════════════════════════════════ */
const DB = (() => {

  const isCloud = () => !!window._sbClient;

  /* ══════════════════════════════════════
     SUPABASE
  ══════════════════════════════════════ */
  const cloud = (() => {
    const sb          = () => window._sbClient;
    const BUCKET      = 'moodboard-images';
    const PROJECTS_T  = 'projects';
    const IMAGES_T    = 'images';

    function dataURLtoBlob(dataURL) {
      const [header, data] = dataURL.split(',');
      const mime   = header.match(/:(.*?);/)[1];
      const binary = atob(data);
      const arr    = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }

    function ext(mime) {
      return mime === 'image/png' ? 'png' : 'jpg';
    }

    return {
      async saveProject(p) {
        const { error } = await sb().from(PROJECTS_T).upsert(p);
        if (error) throw error;
      },

      async getProject(id) {
        const { data, error } = await sb().from(PROJECTS_T).select('*').eq('id', id).single();
        if (error) return null;
        return data;
      },

      async getAllProjects() {
        const { data, error } = await sb().from(PROJECTS_T).select('*');
        if (error) throw error;
        return data || [];
      },

      async deleteProject(id) {
        const { error } = await sb().from(PROJECTS_T).delete().eq('id', id);
        if (error) throw error;
      },

      async saveImage(id, dataURL) {
        const blob     = dataURLtoBlob(dataURL);
        const mime     = blob.type;
        const path     = `${id}.${ext(mime)}`;

        const { error: upErr } = await sb().storage.from(BUCKET).upload(path, blob, {
          upsert: true,
          contentType: mime,
        });
        if (upErr) throw upErr;

        const { data: { publicUrl } } = sb().storage.from(BUCKET).getPublicUrl(path);

        const { error: dbErr } = await sb().from(IMAGES_T).upsert({ id, path, url: publicUrl });
        if (dbErr) throw dbErr;
      },

      async getImage(id) {
        const { data, error } = await sb().from(IMAGES_T).select('url').eq('id', id).single();
        if (error || !data) return null;
        return { id, data: data.url };
      },

      async deleteImage(id) {
        const { data } = await sb().from(IMAGES_T).select('path').eq('id', id).single();
        if (data?.path) {
          await sb().storage.from(BUCKET).remove([data.path]);
        }
        await sb().from(IMAGES_T).delete().eq('id', id);
      },

      async deleteImages(ids) {
        if (!ids?.length) return;
        await Promise.all(ids.map(id => cloud.deleteImage(id)));
      },
    };
  })();

  /* ══════════════════════════════════════
     INDEXEDDB (local / fallback)
  ══════════════════════════════════════ */
  const local = (() => {
    const NAME    = 'MoodboardStudio';
    const VERSION = 1;
    let _db = null;

    function open() {
      return new Promise((resolve, reject) => {
        if (_db) { resolve(_db); return; }
        const req = indexedDB.open(NAME, VERSION);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('images'))   db.createObjectStore('images',   { keyPath: 'id' });
        };
        req.onsuccess = e => { _db = e.target.result; resolve(_db); };
        req.onerror   = e => reject(e.target.error);
      });
    }

    function run(store, mode, fn) {
      return open().then(db => new Promise((resolve, reject) => {
        const tx  = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
      }));
    }

    function getAll(store) {
      return open().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
      }));
    }

    return {
      saveProject:   p    => run('projects', 'readwrite', s => s.put(p)),
      getProject:    id   => run('projects', 'readonly',  s => s.get(id)),
      getAllProjects: ()   => getAll('projects'),
      deleteProject: id   => run('projects', 'readwrite', s => s.delete(id)),
      saveImage:     (id, data) => run('images', 'readwrite', s => s.put({ id, data })),
      getImage:      id   => run('images', 'readonly',  s => s.get(id)),
      deleteImage:   id   => run('images', 'readwrite', s => s.delete(id)),
      deleteImages(ids) {
        if (!ids?.length) return Promise.resolve();
        return open().then(db => new Promise((resolve, reject) => {
          const tx = db.transaction('images', 'readwrite');
          const st = tx.objectStore('images');
          let n = 0;
          ids.forEach(id => {
            const r = st.delete(id);
            r.onsuccess = () => { if (++n === ids.length) resolve(); };
            r.onerror   = e => reject(e.target.error);
          });
        }));
      },
    };
  })();

  /* ══════════════════════════════════════
     ROUTER — elige backend automáticamente
  ══════════════════════════════════════ */
  return {
    saveProject:   p        => isCloud() ? cloud.saveProject(p)       : local.saveProject(p),
    getProject:    id       => isCloud() ? cloud.getProject(id)       : local.getProject(id),
    getAllProjects: ()       => isCloud() ? cloud.getAllProjects()      : local.getAllProjects(),
    deleteProject: id       => isCloud() ? cloud.deleteProject(id)    : local.deleteProject(id),
    saveImage:     (id, d)  => isCloud() ? cloud.saveImage(id, d)     : local.saveImage(id, d),
    getImage:      id       => isCloud() ? cloud.getImage(id)         : local.getImage(id),
    deleteImage:   id       => isCloud() ? cloud.deleteImage(id)      : local.deleteImage(id),
    deleteImages:  ids      => isCloud() ? cloud.deleteImages(ids)    : local.deleteImages(ids),
  };
})();
