const { useState, PureComponent } = React;

class ClassComponent extends PureComponent {
  state = {
    count: 0,
  };

  render() {
    const { count } = this.state;
    console.log('class component re-render');

    return (
      <div>
        <h3>{count}</h3>
        <div>
          <button onClick={() => this.setState({ count: count + 1 })}>
            change
          </button>
          <button onClick={() => this.setState({ count })}>unchange</button>
        </div>
      </div>
    );
  }
}

const FunctionComponent = () => {
  const [count, setCount] = useState(0);
  console.log('function component re-render');

  return (
    <div>
      <h3>{count}</h3>
      <div>
        <button onClick={() => setCount(count + 1)}>change</button>
        <button onClick={() => setCount(count)}>unchange</button>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <div>
      <h2>ClassComponent</h2>
      <ClassComponent />
      <h2>FunctionComponent</h2>
      <FunctionComponent />
    </div>
  );
};

ReactDOM.render(<App />, document.querySelector('#app'));
