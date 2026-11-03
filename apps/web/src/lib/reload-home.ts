/** A full load of the start page, so nothing cached from the old workspace survives a reset. */
export const reloadHome = (): void => window.location.assign('/');
