ActiveRecord::Schema.define do
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
