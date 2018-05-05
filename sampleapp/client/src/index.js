import React, { PureComponent } from 'react'
import { render } from 'react-dom'
import { ArSyncModel } from 'ar_sync'
import ActionCable from 'actioncable'
import ArSyncActionCableAdapter from 'ar_sync/vendor/assets/javascripts/ar_sync_actioncable_adapter'
ArSyncModel.setConnectionAdapter(new ArSyncActionCableAdapter())

class PostItem extends PureComponent {
  render() {
    const { post } = this.props
    return <div>
      <a href={'/posts/' + post.id}>
        <b>{post.title}</b>
      </a>
      &nbsp;&nbsp;
      <small>date: {post.created_at} </small>
      <small>&nbsp;&nbsp;comments:{post.comments_count}</small>
    </div>
  }
}

class TopPage extends PureComponent {
  constructor(props, context) {
    super(props, context)
    this.state = {}
    const currentUserModel = new ArSyncModel({
      api: 'profile',
      query: [
        'name', 'followed_count', 'following_count',
        { posts: ['title', 'comments_count', 'created_at'] }
      ]
    }, { immutable: true })
    const newPostsModel = new ArSyncModel({
      api: 'newposts',
      query: ['user', 'title', 'created_at', 'comments_count']
    }, { immutable: true })
    currentUserModel.subscribe('change', () => this.setState({ currentUser: currentUserModel.data }))
    newPostsModel.subscribe('change', () => this.setState({ newPosts: newPostsModel.data }))
  }
  render() {
    if (!this.state.currentUser) return <div>loading...</div>
    const { currentUser } = this.state
    return <div>
      <h1>TopPage React Version: welcome {currentUser.name}!</h1>
      <h2>
        Following: {currentUser.following_count}
        &nbsp;&nbsp;
        Followers: {currentUser.followed_count}
      </h2>
      <hr/>
      <h2>Your posts</h2>
      {currentUser.posts.map(post => <PostItem key={post.id} post={post} />)}
    </div>
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  render(<TopPage/>, document.querySelector('#root'))
})
