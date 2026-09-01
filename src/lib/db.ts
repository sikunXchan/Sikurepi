import { sql } from '@vercel/postgres';

export type Ingredient = {
  id: number;
  user_id?: string;
  name: string;
  is_pinned: boolean;
  category: string;
  created_at: Date;
};

export type ShoppingItem = {
  id: number;
  user_id?: string;
  name: string;
  category?: string;
  is_completed: boolean;
  created_at: Date;
};

export type NutritionData = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type SavedRecipe = {
  id: number;
  user_id?: string;
  title: string;
  time: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  image_url: string | null;
  nutrition: NutritionData | null;
  genre: string | null;
  saved_at: string;
};

export type UserStats = {
  user_id: string;
  streak_days: number;
  last_cooked_date: string | null;
  total_cooked: number;
  saved_food_count: number;
  chef_level: number;
};

// スキーマの自動マイグレーション（カラム追加などを安全に実行）
export async function ensureSchema() {
  try {
    // 既存テーブルに user_id を追加 (IF NOT EXISTS)
    await sql
      CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(64) DEFAULT 'anonymous_user',
        name VARCHAR(255) NOT NULL,
        is_pinned BOOLEAN DEFAULT FALSE,
        category VARCHAR(50) DEFAULT 'その他',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    ;
    await sql
      DO  BEGIN
        ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) DEFAULT 'anonymous_user';
      EXCEPTION WHEN OTHERS THEN NULL;
      END ;
    ;

    await sql
      CREATE TABLE IF NOT EXISTS shopping_items (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(64) DEFAULT 'anonymous_user',
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) DEFAULT 'その他',
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    ;
    await sql
      DO  BEGIN
        ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) DEFAULT 'anonymous_user';
        ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'その他';
      EXCEPTION WHEN OTHERS THEN NULL;
      END ;
    ;

    await sql
      CREATE TABLE IF NOT EXISTS saved_recipes (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(64) DEFAULT 'anonymous_user',
        title VARCHAR(255) NOT NULL,
        time VARCHAR(50),
        ingredients JSONB NOT NULL,
        steps JSONB NOT NULL,
        tips TEXT,
        image_url TEXT,
        nutrition JSONB,
        genre VARCHAR(50),
        saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    ;
    await sql
      DO  BEGIN
        ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) DEFAULT 'anonymous_user';
        ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS nutrition JSONB;
        ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS genre VARCHAR(50);
      EXCEPTION WHEN OTHERS THEN NULL;
      END ;
    ;

    await sql
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id VARCHAR(64) PRIMARY KEY,
        streak_days INT DEFAULT 0,
        last_cooked_date DATE,
        total_cooked INT DEFAULT 0,
        saved_food_count INT DEFAULT 0,
        chef_level INT DEFAULT 1,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    ;
  } catch (err) {
    console.error('Schema ensure failed or already present:', err);
  }
}

// --- Ingredients (User Scoped) ---

export async function getIngredients(userId: string = 'anonymous_user'): Promise<Ingredient[]> {
  try {
    const { rows } = await sql<Ingredient>
      SELECT * FROM ingredients
      WHERE user_id = 
      ORDER BY is_pinned DESC, created_at DESC
    ;
    return rows;
  } catch (error) {
    console.error('Failed to fetch ingredients:', error);
    return [];
  }
}

export async function addIngredient(name: string, category: string = 'その他', userId: string = 'anonymous_user'): Promise<Ingredient | null> {
  try {
    const cleanName = name.trim();
    const { rows: existing } = await sql<Ingredient>
      SELECT * FROM ingredients
      WHERE LOWER(TRIM(name)) = LOWER()
        AND user_id = 
      LIMIT 1
    ;

    if (existing.length > 0) {
      return existing[0];
    }

    const { rows } = await sql<Ingredient>
      INSERT INTO ingredients (user_id, name, is_pinned, category)
      VALUES (, , false, )
      RETURNING *
    ;
    return rows[0];
  } catch (error) {
    console.error('Failed to add ingredient:', error);
    return null;
  }
}

export async function deleteIngredient(id: number, userId: string = 'anonymous_user'): Promise<boolean> {
  try {
    await sqlDELETE FROM ingredients WHERE id =  AND user_id = ;
    return true;
  } catch (error) {
    console.error('Failed to delete ingredient:', error);
    return false;
  }
}

export async function consumeIngredients(ingredientNames: string[], userId: string = 'anonymous_user'): Promise<number> {
  if (!ingredientNames || ingredientNames.length === 0) return 0;
  let count = 0;
  for (const raw of ingredientNames) {
    const name = raw.trim();
    if (!name) continue;
    try {
      const res = await sql
        DELETE FROM ingredients
        WHERE user_id = 
          AND (LOWER(TRIM(name)) = LOWER() OR LOWER() LIKE '%' || LOWER(TRIM(name)) || '%')
      ;
      count += res.rowCount || 0;
    } catch (e) {
      console.error(Failed to consume ingredient :, e);
    }
  }
  return count;
}

export async function togglePinIngredient(id: number, userId: string = 'anonymous_user'): Promise<Ingredient | null> {
  try {
    const { rows } = await sql<Ingredient>
      UPDATE ingredients
      SET is_pinned = NOT is_pinned
      WHERE id =  AND user_id = 
      RETURNING *
    ;
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to toggle pin:', error);
    return null;
  }
}

export async function updateIngredientCategory(id: number, category: string, userId: string = 'anonymous_user'): Promise<Ingredient | null> {
  try {
    const { rows } = await sql<Ingredient>
      UPDATE ingredients
      SET category = 
      WHERE id =  AND user_id = 
      RETURNING *
    ;
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to update category:', error);
    return null;
  }
}

// --- Shopping Items (User Scoped) ---

export async function getShoppingItems(userId: string = 'anonymous_user'): Promise<ShoppingItem[]> {
  try {
    const { rows } = await sql<ShoppingItem>
      SELECT * FROM shopping_items
      WHERE user_id = 
      ORDER BY is_completed ASC, created_at DESC
    ;
    return rows;
  } catch (error) {
    console.error('Failed to fetch shopping items:', error);
    return [];
  }
}

export async function addShoppingItem(name: string, category: string = 'その他', userId: string = 'anonymous_user'): Promise<ShoppingItem | null> {
  try {
    const cleanName = name.trim();
    const { rows: existing } = await sql<ShoppingItem>
      SELECT * FROM shopping_items
      WHERE LOWER(TRIM(name)) = LOWER()
        AND user_id = 
        AND is_completed = false
      LIMIT 1
    ;
    if (existing.length > 0) return existing[0];

    const { rows } = await sql<ShoppingItem>
      INSERT INTO shopping_items (user_id, name, category, is_completed)
      VALUES (, , , false)
      RETURNING *
    ;
    return rows[0];
  } catch (error) {
    console.error('Failed to add shopping item:', error);
    return null;
  }
}

export async function toggleShoppingItem(id: number, userId: string = 'anonymous_user'): Promise<ShoppingItem | null> {
  try {
    const { rows } = await sql<ShoppingItem>
      UPDATE shopping_items
      SET is_completed = NOT is_completed
      WHERE id =  AND user_id = 
      RETURNING *
    ;
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to toggle shopping item:', error);
    return null;
  }
}

export async function deleteShoppingItem(id: number, userId: string = 'anonymous_user'): Promise<boolean> {
  try {
    await sqlDELETE FROM shopping_items WHERE id =  AND user_id = ;
    return true;
  } catch (error) {
    console.error('Failed to delete shopping item:', error);
    return false;
  }
}

// 買い出し完了品を在庫へ移動
export async function transferCompletedShoppingToInventory(userId: string = 'anonymous_user'): Promise<number> {
  try {
    const { rows: completed } = await sql<ShoppingItem>
      SELECT * FROM shopping_items
      WHERE user_id =  AND is_completed = true
    ;
    let count = 0;
    for (const item of completed) {
      await addIngredient(item.name, item.category || 'その他', userId);
      await deleteShoppingItem(item.id, userId);
      count++;
    }
    return count;
  } catch (error) {
    console.error('Failed to transfer shopping to inventory:', error);
    return 0;
  }
}

// --- Saved Recipes (User Scoped) ---

export async function getSavedRecipes(userId: string = 'anonymous_user'): Promise<SavedRecipe[]> {
  try {
    const { rows } = await sql<SavedRecipe>
      SELECT * FROM saved_recipes
      WHERE user_id = 
      ORDER BY saved_at DESC
    ;
    return rows;
  } catch (error) {
    console.error('Failed to fetch saved recipes:', error);
    return [];
  }
}

export async function getRecentRecipeNames(limit: number = 5, userId: string = 'anonymous_user'): Promise<string[]> {
  try {
    const { rows } = await sql<{ title: string }>
      SELECT title FROM saved_recipes
      WHERE user_id = 
      ORDER BY saved_at DESC
      LIMIT 
    ;
    return rows.map(r => r.title);
  } catch (error) {
    console.error('Failed to fetch recent recipe names:', error);
    return [];
  }
}

export async function saveRecipe(
  recipe: Omit<SavedRecipe, 'id' | 'saved_at' | 'user_id'>,
  userId: string = 'anonymous_user'
): Promise<SavedRecipe | null> {
  try {
    const { rows } = await sql<SavedRecipe>
      INSERT INTO saved_recipes (user_id, title, time, ingredients, steps, tips, image_url, nutrition, genre)
      VALUES (
        ,
        ,
        ,
        ,
        ,
        ,
        ,
        ,
        
      )
      RETURNING *
    ;
    return rows[0];
  } catch (error) {
    console.error('Failed to save recipe:', error);
    return null;
  }
}

export async function deleteSavedRecipe(id: number, userId: string = 'anonymous_user'): Promise<boolean> {
  try {
    await sqlDELETE FROM saved_recipes WHERE id =  AND user_id = ;
    return true;
  } catch (error) {
    console.error('Failed to delete saved recipe:', error);
    return false;
  }
}

export async function touchSavedRecipe(id: number, userId: string = 'anonymous_user'): Promise<SavedRecipe | null> {
  try {
    const { rows } = await sql<SavedRecipe>
      UPDATE saved_recipes
      SET saved_at = CURRENT_TIMESTAMP
      WHERE id =  AND user_id = 
      RETURNING *
    ;
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to touch saved recipe:', error);
    return null;
  }
}

// --- Gamification & User Stats ---

export async function getUserStats(userId: string = 'anonymous_user'): Promise<UserStats> {
  try {
    const { rows } = await sql<UserStats>
      SELECT * FROM user_stats WHERE user_id =  LIMIT 1
    ;
    if (rows.length > 0) return rows[0];

    // 初期レコードを作成して返す
    const { rows: created } = await sql<UserStats>
      INSERT INTO user_stats (user_id, streak_days, last_cooked_date, total_cooked, saved_food_count, chef_level)
      VALUES (, 0, NULL, 0, 0, 1)
      RETURNING *
    ;
    return created[0];
  } catch (e) {
    console.error('Failed to get user stats:', e);
    return {
      user_id: userId,
      streak_days: 0,
      last_cooked_date: null,
      total_cooked: 0,
      saved_food_count: 0,
      chef_level: 1,
    };
  }
}

export async function recordCookingDone(userId: string = 'anonymous_user', consumedFoodCount: number = 0): Promise<UserStats> {
  try {
    const stats = await getUserStats(userId);
    const today = new Date().toISOString().split('T')[0];
    let newStreak = stats.streak_days;

    if (stats.last_cooked_date) {
      const lastDate = new Date(stats.last_cooked_date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const newTotal = stats.total_cooked + 1;
    const newSavedFood = stats.saved_food_count + consumedFoodCount;
    // シェフレベル計算: 3回でLv2, 7回でLv3, 15回でLv4, 30回でLv5...
    const newLevel = Math.max(1, Math.min(10, Math.floor(Math.sqrt(newTotal * 2)) + 1));

    const { rows } = await sql<UserStats>
      INSERT INTO user_stats (user_id, streak_days, last_cooked_date, total_cooked, saved_food_count, chef_level, updated_at)
      VALUES (, , , , , , CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        streak_days = ,
        last_cooked_date = ,
        total_cooked = ,
        saved_food_count = ,
        chef_level = ,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    ;
    return rows[0];
  } catch (e) {
    console.error('Failed to record cooking done:', e);
    return {
      user_id: userId,
      streak_days: 1,
      last_cooked_date: new Date().toISOString().split('T')[0],
      total_cooked: 1,
      saved_food_count: consumedFoodCount,
      chef_level: 1,
    };
  }
}
