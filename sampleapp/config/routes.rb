Rails.application.routes.draw do
  post '/sync_api', to: 'sync_api#api_call'
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  root to: 'top#show'

  resources :posts, except: :index do
    member do
      post :reaction
    end
  end
  resources :users, only: [:index, :show]

  resources :comments, except: [:new, :index] do
    member { post :reaction }
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
