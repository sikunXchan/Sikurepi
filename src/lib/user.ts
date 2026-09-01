import { useEffect, useState } from 'react';

const USER_ID_KEY = 'cooking_app_device_user_id';

// クライアント側で一意の匿名UUIDを取得/生成
export function getOrCreateClientUserId(): string {
  if (typeof window === 'undefined') return 'anonymous_user';
  
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = 'usr_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem(USER_ID_KEY, userId);
  }
  document.cookie = ${USER_ID_KEY}=; path=/; max-age=315360000; SameSite=Lax;
  return userId;
}

// Reactコンポーネント用フック
export function useUserId(): string {
  const [userId, setUserId] = useState<string>('anonymous_user');

  useEffect(() => {
    setUserId(getOrCreateClientUserId());
  }, []);

  return userId;
}

// APIリクエスト用の共通ヘッダー取得
export function getApiHeaders(): Record<string, string> {
  const userId = typeof window !== 'undefined' ? getOrCreateClientUserId() : 'anonymous_user';
  return {
    'Content-Type': 'application/json',
    'x-user-id': userId,
  };
}

// サーバーサイド（API Route）でユーザーIDを取得
export function getUserIdFromRequest(req: Request): string {
  const headerUserId = req.headers.get('x-user-id');
  if (headerUserId && headerUserId.trim()) {
    return headerUserId.trim();
  }

  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp((?:^|;\\s*)=([^;]*)));
  if (match && match[1]) {
    return decodeURIComponent(match[1].trim());
  }

  return 'anonymous_user';
}
