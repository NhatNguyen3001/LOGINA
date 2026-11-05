import { describe, expect, it } from 'vitest';
import { assetRefs } from '../keep-live-assets.js';

describe('keep-live-assets', () => {
  it('finds assets in the start page and relative chunk imports in code', () => {
    const html = '<script type="module" src="/assets/index-a1.js"></script><link rel="stylesheet" href="/assets/index-b2.css">';
    const chunk = 'const m = () => import("./TaskRunner-c3.js"); const font = "assets/font-d4.woff2"; import "./index-a1.js";';
    expect(assetRefs(html).sort()).toEqual(['assets/index-a1.js', 'assets/index-b2.css']);
    expect(assetRefs(chunk).sort()).toEqual(['assets/TaskRunner-c3.js', 'assets/font-d4.woff2', 'assets/index-a1.js']);
  });

  it('ignores outside links and names that are not code or media', () => {
    expect(assetRefs('<a href="https://example.com/assets/x.js">x</a> "./notes.txt" "/assets/data.json"')).toEqual([]);
  });
});
