Rails.application.routes.draw do
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  get 'foobar/:key', to: 'foobar#broadcast'
  root to: 'top#show'
  resources :posts, except: :index do
    post :reaction
  end
  resources :users, only: :index

  resources :comments, only: [:create, :destroy] do
    post :reaction
  end

  get '/followings', to: 'follows#followings'
  get '/followeds', to: 'follows#followees'
  resources :follows, only: [:create, :destroy]
  resources :sessions, only: [:new, :create] do
    collection { get :destroy }
  end
end
