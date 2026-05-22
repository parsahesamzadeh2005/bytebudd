import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dbTypeLabel(dbType: string): string {
  const labels: Record<string, string> = {
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    mariadb: "MariaDB",
    sqlite: "SQLite",
  };
  return labels[dbType] || dbType;
}

export function dbTypeColor(dbType: string): string {
  const colors: Record<string, string> = {
    postgresql: "bg-blue-100 text-blue-800",
    mysql: "bg-orange-100 text-orange-800",
    mariadb: "bg-amber-100 text-amber-800",
    sqlite: "bg-gray-100 text-gray-800",
  };
  return colors[dbType] || "bg-gray-100 text-gray-800";
}
