CREATE TABLE item_master (id uuid PRIMARY KEY, fsc_code varchar(10), profile_code varchar(10), deleted_flag varchar(1));
CREATE TABLE detail_line (id uuid PRIMARY KEY, units_number integer);
CREATE TABLE IF NOT EXISTS "store_link" (id uuid PRIMARY KEY, target_code varchar(2), store_id integer);
CREATE TABLE sim_key (id uuid PRIMARY KEY, sim_target varchar(2));
CREATE TABLE new_table (id uuid PRIMARY KEY, key_code varchar(5));
