require 'benchmark'
require 'active_record'
config = {
  adapter: 'sqlite3',
  database: 'development.sqlite3',
  pool: 5,
  timeout: 5000
}
File.unlink config[:database] if File.exist? config[:database]
ActiveRecord::Base.establish_connection config
ActiveRecord::Base.logger = Logger.new(STDOUT)
ActiveRecord::Migration::Current.class_eval do
  create_table :users do |t|
    t.string :name
  end
  create_table :posts do |t|
    t.references :user
    t.string :title
    t.text :body
    t.timestamps
  end

  create_table :comments do |t|
    t.references :post
    t.text :body
    t.timestamps
  end

  create_table :stars do |t|
    t.references :comment
    t.references :user
    t.timestamps
  end
end
