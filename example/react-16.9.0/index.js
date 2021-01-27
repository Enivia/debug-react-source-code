function App() {
  const [count, setCount] = React.useState(0);

  console.log('app render');

  return (
    <div>
      <h3>{count}</h3>
      <button onClick={() => setCount(count + 1)}>change</button>
      <button onClick={() => setCount(count)}>unchange</button>
    </div>
  );
}

ReactDOM.render(<App />, document.querySelector('#app'));
