
import { fileURLToPath } from 'node:url';

export const build = {
  rollupOptions: {
    input: {
      controller: fileURLToPath(
        new URL('../index.html', import.meta.url)
      ),
      upload: fileURLToPath(
        new URL('../upload.html', import.meta.url)
      )
    }
  }
};
