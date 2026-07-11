// Maps a user role to its default landing route.
export function homeFor(role) {
  switch (role) {
    case 'owner': return '/listings';
    case 'admin': return '/admin';
    case 'tenant':
    default: return '/browse';
  }
}
