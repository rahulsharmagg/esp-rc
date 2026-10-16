
const BACKEND = 'http://localhost:3000';

export const proxy = {
  '/firmware': BACKEND,
  '/admin/api': BACKEND,
  '/versions': BACKEND,
  '/progress': { target: BACKEND, ws: true }
};

export default BACKEND;
