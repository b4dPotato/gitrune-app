/** Hard UI/query bounds that keep unusually large repositories responsive. */
export const GRAPH_PAGE_SIZE = 200;
export const MAX_GRAPH_PAGES = 10;
export const MAX_GRAPH_COMMITS = GRAPH_PAGE_SIZE * MAX_GRAPH_PAGES;
export const MAX_RENDERED_DIFF_ROWS = 4_000;
export const MAX_RENDERED_CHANGED_FILES = 2_000;
export const MAX_RENDERED_BLAME_LINES = 4_000;
export const MAX_RENDERED_HISTORY_ITEMS = 500;
