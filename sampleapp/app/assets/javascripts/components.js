Vue.component('reactions', {
  props: ['url', 'summary', 'mine', 'iconclass'],
  template: `
    <div>
      <a class='reaction-button' :class="{active: mine && mine.kind == 'like'}">
        <i :class="'material-icons ' + iconclass" @click='like'>thumb_up</i>
      </a>
      <a class='reaction-button' :class="{active: mine && mine.kind == 'dislike'}">
        <i :class="'material-icons ' + iconclass" @click='dislike'>thumb_down</i>
      </a>
      <small>
        <span v-if='summary.like'>
          <i class='material-icons'>thumb_up</i>:{{summary.like}}
        </span>
        <span v-if='summary.dislike'>
          <i class='material-icons'>thumb_down</i>:{{summary.dislike}}
        </span>
      </small>
    </div>
  `,
  methods: {
    like() {
      this.changeReaction(this.mine && this.mine.kind === 'like' ? null : 'like')
    },
    dislike() {
      this.changeReaction(this.mine && this.mine.kind === 'dislike' ? null : 'dislike')
    },
    changeReaction(kind) {
      fetch(this.url + '?kind=' + kind, { credentials: 'include', method: 'POST' })
    }
  }
})

Vue.component('comment-form', {
  data() { return { text: '' } },
  props: ['post_id'],
  template: `
    <form class='comment-form' @submit.prevent='send'>
      <input v-model='text' placeholder='comment'>
      <a @click='send'><i class='material-icons'>send</i></a>
    </form>
  `,
  methods: {
    send() {
      if (!this.text) return
      const url = '/comments?post_id=' + this.post_id
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
      const body = JSON.stringify({ comment: { body:  this.text }})
      const option = { credentials: 'include', method: 'POST', headers, body }
      fetch(url, option)
      this.text = ''
    }
  }


})
