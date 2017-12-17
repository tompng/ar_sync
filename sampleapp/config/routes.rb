Rails.application.routes.draw do
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  get 'foobar/:key', to: 'foobar#broadcast'
  root to: 'top#show'
  resources :posts, except: :index do
    post :reaction
    member { get :sync_api; post :sync_api }
  end
  resources :users, only: :index do
    member { get :sync_api; post :sync_api }
    collection { get :profile_sync_api; post :profile_sync_api }
  end

  resources :comments, only: [:create, :destroy] do
    post :reaction
    member { get :sync_api; post :sync_api }
  end

  get '/followings', to: 'follows#followings'
  get '/followeds', to: 'follows#followees'
  resources :follows, only: [] do
    collection do
      post :follow
      post :unfollow
    end
  end
  resources :sessions, only: [:new, :create] do
    collection { get :destroy }
  end
end
