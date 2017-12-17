Vue.component('reactions', {
  props: ['url', 'summary', 'mine'],
  template: `
    <div>
      <a class='reaction-button' :class="{active: mine && mine.kind == 'like'}">
        <i class=material-icons @click='like'>thumb_up</i>
      </a>
      <a class='reaction-button' :class="{active: mine && mine.kind == 'dislike'}">
        <i class=material-icons @click='dislike'>thumb_down</i>
      </a>
      <small>
        <span v-if='summary.like'>
          <i class='material-icons material-icons-small'>thumb_up</i>:{{summary.like}}
        </span>
        <span v-if='summary.dislike'>
          <i class='material-icons material-icons-small'>thumb_down</i>:{{summary.dislike}}
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
