enum Role {
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
  PARENT = "PARENT",
}
export function isValidRole(role: string): role is Role {
  return Object.values(Role).includes(role as Role);
}
