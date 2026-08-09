"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRelativeTime } from "@/lib/format";

export type CommentNode = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string | null };
  replies: CommentNode[];
};

export default function CommentThread({
  postId,
  comments,
  canComment,
}: {
  postId: string;
  comments: CommentNode[];
  canComment: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canComment && <Composer postId={postId} placeholder="Add a comment…" />}
      {!canComment && (
        <p className="rounded-xl border border-foreground/15 bg-foreground/5 p-3 text-center text-xs text-foreground/50">
          Join this community to comment.
        </p>
      )}
      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-foreground/50">
          No comments yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              postId={postId}
              comment={comment}
              canComment={canComment}
              depth={0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentItem({
  postId,
  comment,
  canComment,
  depth,
}: {
  postId: string;
  comment: CommentNode;
  canComment: boolean;
  depth: number;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li className={depth > 0 ? "ml-4 border-l-2 border-foreground/10 pl-3" : ""}>
      <div className="text-xs text-foreground/50">
        <Link href={`/u/${comment.author.id}`} className="font-medium text-foreground/70">
          {comment.author.displayName ?? "unknown"}
        </Link>{" "}
        · {formatRelativeTime(new Date(comment.createdAt))}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
      {canComment && (
        <button
          onClick={() => setReplying((v) => !v)}
          className="mt-1 text-xs font-medium text-foreground/50 hover:text-foreground/80"
        >
          {replying ? "Cancel" : "Reply"}
        </button>
      )}
      {replying && (
        <div className="mt-2">
          <Composer
            postId={postId}
            parentId={comment.id}
            placeholder={`Reply to ${comment.author.displayName ?? "them"}…`}
            onDone={() => setReplying(false)}
            autoFocus
          />
        </div>
      )}
      {comment.replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              postId={postId}
              comment={reply}
              canComment={canComment}
              depth={Math.min(depth + 1, 1)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function Composer({
  postId,
  parentId,
  placeholder,
  onDone,
  autoFocus = false,
}: {
  postId: string;
  parentId?: string;
  placeholder: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't post the comment");
      setBody("");
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post the comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none transition focus:border-accent"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {body.trim() && (
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground transition active:scale-95 disabled:opacity-50"
        >
          {busy ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
      )}
    </form>
  );
}
