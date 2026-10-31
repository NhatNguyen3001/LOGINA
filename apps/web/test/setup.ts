import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/** The first-visit tour has its own tests; every other test starts past it. */
beforeEach(() => localStorage.setItem('logina.demoTourSeen', '1'));

/** jsdom has no modal dialogs and no resize observer. */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.open = true;
};

afterEach(cleanup);
