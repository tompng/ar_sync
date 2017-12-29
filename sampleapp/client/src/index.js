import React, { PureComponent } from 'react'
import { render } from 'react-dom'
import { ARSyncImmutableData } from 'ar_sync'

class TopPage extends PureComponent {
  render() {
    const { currentUser } = this.props
    return <div>
      <h1>TopPage React Version: welcome {currentUser.name}!</h1>
      <h2>
        Following: {currentUser.following_count}
        &nbsp;&nbsp;
        Followers: {currentUser.followed_count}
      </h2>
      <hr/>
      <h2>Your posts</h2>
      {currentUser.posts.map((post)=>{
        return <div key={post.id}>
          <a href={'/posts/' + post.id}>
            <b>{post.title}</b>
          </a>
          &nbsp;&nbsp;
          <small>date: {post.created_at} </small>
          <small>&nbsp;&nbsp;comments:{post.comments_count}</small>
        </div>
      })}
    </div>
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const syncData = new ARSyncImmutableData({
    currentUser: {
      api: 'profile',
      query: [
        'name', 'followed_count', 'following_count',
        { posts: ['title', 'comments_count', 'created_at'] }
      ]
    },
    newPosts: {
      api: 'newposts',
      query: ['user', 'title', 'created_at', 'comments_count']
    }
  }).load(update).changed(update)
  function update(){
    render(
      <TopPage {...syncData.data} />,
      document.querySelector('#root')
    )
  }
})
