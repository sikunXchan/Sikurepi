CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) DEFAULT 'anonymous_user',
    name VARCHAR(255) NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    category VARCHAR(50) DEFAULT 'その他',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_items (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) DEFAULT 'anonymous_user',
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'その他',
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS user_stats (
    user_id VARCHAR(64) PRIMARY KEY,
    streak_days INT DEFAULT 0,
    last_cooked_date DATE,
    total_cooked INT DEFAULT 0,
    saved_food_count INT DEFAULT 0,
    chef_level INT DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
