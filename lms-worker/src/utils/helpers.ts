/**
 * Helper utilities for LMS Worker
 */

// Generate unique ID (UUID v4 style)
export function generateId(): string {
  return crypto.randomUUID();
}

// Hash password using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Combine salt and password
  const combined = new Uint8Array(salt.length + data.length);
  combined.set(salt);
  combined.set(data, salt.length);
  
  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return salt:hash format
  return `${saltHex}:${hashHex}`;
}

// Verify password against hash
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, originalHash] = storedHash.split(':');
  
  if (!saltHex || !originalHash) {
    return false;
  }
  
  // Convert salt from hex to Uint8Array
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Combine salt and password
  const combined = new Uint8Array(salt.length + data.length);
  combined.set(salt);
  combined.set(data, salt.length);
  
  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Compare hashes
  return hashHex === originalHash;
}

// Generate random token
export function generateToken(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Format timestamp to ISO string
export function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

// Calculate level from XP
export function calculateLevel(xp: number): number {
  // XP required per level: 100, 200, 300, 400...
  // Level 1: 0-99 XP
  // Level 2: 100-299 XP
  // Level 3: 300-599 XP
  let level = 1;
  let xpRequired = 0;
  
  while (xp >= xpRequired + (level * 100)) {
    xpRequired += level * 100;
    level++;
  }
  
  return level;
}

// Calculate XP progress to next level
export function xpToNextLevel(xp: number): { current: number; required: number; percentage: number } {
  const level = calculateLevel(xp);
  
  let xpAtCurrentLevel = 0;
  for (let i = 1; i < level; i++) {
    xpAtCurrentLevel += i * 100;
  }
  
  const currentLevelXP = xp - xpAtCurrentLevel;
  const requiredForNextLevel = level * 100;
  const percentage = Math.floor((currentLevelXP / requiredForNextLevel) * 100);
  
  return {
    current: currentLevelXP,
    required: requiredForNextLevel,
    percentage
  };
}
