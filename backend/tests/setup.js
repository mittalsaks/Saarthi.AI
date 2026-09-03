// Runs before each test file's tests, and before that file requires
// ../src/app - so JWT_SECRET etc. are already in process.env by the
// time requireAuth.js / jwt.js read them.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_do_not_use_in_prod';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.NODE_ENV = 'test';
