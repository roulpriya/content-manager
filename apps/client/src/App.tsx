import { trpc } from "./trpc";

export default function App() {
  const hello = trpc.hello.useQuery({ name: "Content Manager" });

  return (
    <div>
      <h1>Content Manager</h1>
      {hello.data && <p>{hello.data.message}</p>}
    </div>
  );
}
