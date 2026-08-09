import CommunityForm from "./CommunityForm";

export const metadata = { title: "New community" };

export default function NewCommunityPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New community</h1>
      <CommunityForm />
    </div>
  );
}
