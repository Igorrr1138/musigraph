

## Plan: Artist Cover Image + Navigation Breadcrumbs

### 1. Artist Cover Image on ArtistPage

Currently the artist page shows a generic `<User />` icon. We'll fetch a real image using theaudiodb.com (same pattern as `ArtistCard.tsx`) with a fallback to the icon.

**File: `src/pages/ArtistPage.tsx`**
- Add `imageError` state and construct image URL from artist name
- Replace the static `<User />` icon with an `<img>` tag that falls back to the icon on error
- Style: keep the circular 48x48 avatar but show the actual artist photo

### 2. Breadcrumb Navigation

Replace the simple "Back to search" arrow links with proper breadcrumbs using the existing `src/components/ui/breadcrumb.tsx` component.

**File: `src/pages/ArtistPage.tsx`**
- Replace the `<ArrowLeft> Back to search` link with breadcrumbs: `Home > {Artist Name}`

**File: `src/pages/AlbumPage.tsx`**
- Replace the `<ArrowLeft> Back to search` link with breadcrumbs: `Home > {Artist Name} > {Album Title}`
- The artist name links to `/artist/{artistId}`, enabling direct navigation back to the artist

### Technical Details

- Import `Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage` from `@/components/ui/breadcrumb`
- Use React Router's `<Link>` inside `BreadcrumbLink` via `asChild` prop
- Artist image URL pattern: `https://www.theaudiodb.com/images/media/artist/thumb/{name}.jpg` (lowercased, spaces removed) -- matching existing `ArtistCard.tsx` logic

