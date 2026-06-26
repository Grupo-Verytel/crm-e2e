require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const shared = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  timezone: '+00:00',
};

module.exports = {
  development: shared,
  test: shared,
  production: shared,
};
