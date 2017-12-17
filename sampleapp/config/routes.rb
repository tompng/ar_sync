Rails.application.routes.draw do
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  get 'foobar/:key', to: 'foobar#broadcast'
  root to: 'top#show'
  resources :posts, except: :index do
    member do
      post :reaction
      get :sync_api
      post :sync_api
    end
  end
  resources :users, only: [:index, :show] do
    member { get :sync_api; post :sync_api }
    collection { get :profile_sync_api; post :profile_sync_api }
  end

  resources :comments, except: [:new, :index] do
    member do
      post :reaction
      get :sync_api
      post :sync_api
    end
  end

  get '/followings', to: 'follows#followings'
  get '/followeds', to: 'follows#followees'
  resources :follows, only: :index do
    collection do
      post :follow
      post :unfollow
    end
  end

  get '/user/sign_in', to: 'sessions#new', as: :sign_in
  post '/user/sign_in', to: 'sessions#create'
  get '/user/sign_out', to: 'sessions#destroy', as: :sign_out
end
