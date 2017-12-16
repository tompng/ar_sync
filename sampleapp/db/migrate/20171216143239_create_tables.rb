class CreateTables < ActiveRecord::Migration[5.1]
  def change
    create_table :users do |t|
      t.string :name
      t.timestamps
    end

    create_table :follows do |t|
      t.references :from, index: false
      t.references :to
      t.timestamps
      t.index [:from_id, :to_id], unique: true
    end

    create_table :posts do |t|
      t.references :user
      t.string :title
      t.text :body
      t.timestamps
    end

    create_table :comments do |t|
      t.references :post
      t.references :user
      t.text :body
      t.timestamps
    end

    create_table :reactions do |t|
      t.references :target, polymorphic: true, index: false
      t.references :user
      t.string :kind
      t.index [:target_type, :target_id, :user_id], unique: true
    end
  end
end
