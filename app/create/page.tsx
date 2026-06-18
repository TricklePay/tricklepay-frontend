import { CreateForm } from "@/components/create-form";

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">New stream</h1>
      <CreateForm />
    </main>
  );
}
