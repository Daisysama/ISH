-- 测试库与开发库分离：pytest 跑在 ish_test 上，不会污染 docker compose 里的演示数据。
CREATE DATABASE ish_test OWNER ish;
