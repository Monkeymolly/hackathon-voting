import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kyrunrldlaomycezddtr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_k4JjSSLmUKRhTGpUV0wbcQ_ubhFXojx";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GROUPS = ["Group 1", "Group 2", "Group 3", "Group 4"];
const ABSTAIN = "Abstain";

function calculateResults(votes) {
  const result = Object.fromEntries(GROUPS.map((group) => [group, 0]));

  votes.forEach((vote) => {
    [vote.vote1, vote.vote2].forEach((choice) => {
      if (GROUPS.includes(choice)) {
        result[choice] += 1;
      }
    });
  });

  return result;
}

export default function App() {
  const [mode, setMode] = useState("vote");
  const [ownGroup, setOwnGroup] = useState("");
  const [vote1, setVote1] = useState("");
  const [vote2, setVote2] = useState("");
  const [votes, setVotes] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState("");

  const [showConfetti, setShowConfetti] = useState(false);
  const previousVoteCount = useRef(0);
  const isFirstLoad = useRef(true);

  const availableChoices = useMemo(() => {
    if (!ownGroup) return [];
    return [...GROUPS.filter((group) => group !== ownGroup), ABSTAIN];
  }, [ownGroup]);

  const results = useMemo(() => calculateResults(votes), [votes]);
  const maxVotes = Math.max(...Object.values(results), 1);
  const totalValidVotes = Object.values(results).reduce((a, b) => a + b, 0);
  const winner = Object.entries(results).sort((a, b) => b[1] - a[1])[0];

  const canSubmit = ownGroup && vote1 && vote2 && !loading && !hasVoted;

  useEffect(() => {
    const votedFlag = localStorage.getItem("hackathon_voted2");

    if (votedFlag === "true") {
      setHasVoted(true);
      setSubmitted(true);
    }

    fetchVotes();

    const channel = supabase
      .channel("votes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => {
          fetchVotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchVotes() {
    const { data, error } = await supabase
      .from("votes")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      if (!isFirstLoad.current && data.length > previousVoteCount.current) {
        setShowConfetti(true);

        setTimeout(() => {
          setShowConfetti(false);
        }, 1800);
      }

      previousVoteCount.current = data.length;
      isFirstLoad.current = false;
      setVotes(data);
    }
  }

  async function submitVote() {
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    const { error } = await supabase.from("votes").insert([
      {
        own_group: ownGroup,
        vote1,
        vote2,
      },
    ]);

    setLoading(false);

    if (error) {
      setError("Submit failed. Please try again.");
      console.error(error);
      return;
    }

    localStorage.setItem("hackathon_voted2", "true");
    setHasVoted(true);
    setSubmitted(true);
    fetchVotes();
  }

  function resetForm() {
    setOwnGroup("");
    setVote1("");
    setVote2("");
    setSubmitted(false);
    setError("");
  }

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <div>
            <h1 className="title">Hackathon Best Idea Voting</h1>
            <div className="subtitle">
              Vote for the BEST idea · 4 teams · 2 votes per person · no self-voting
            </div>
          </div>

          <div className="tab-group">
            <button
              className={mode === "vote" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setMode("vote")}
            >
              Vote Page
            </button>
            <button
              className={mode === "results" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setMode("results")}
            >
              Results
            </button>
          </div>
        </header>

        {mode === "vote" ? (
          <VotePage
            ownGroup={ownGroup}
            setOwnGroup={setOwnGroup}
            vote1={vote1}
            setVote1={setVote1}
            vote2={vote2}
            setVote2={setVote2}
            availableChoices={availableChoices}
            submitted={submitted}
            hasVoted={hasVoted}
            loading={loading}
            error={error}
            canSubmit={canSubmit}
            submitVote={submitVote}
            resetForm={resetForm}
          />
        ) : (
          <ResultsPage
            votes={votes}
            results={results}
            maxVotes={maxVotes}
            totalValidVotes={totalValidVotes}
            winner={winner}
            showConfetti={showConfetti}
          />
        )}
      </div>
    </div>
  );
}

function VotePage({
  ownGroup,
  setOwnGroup,
  vote1,
  setVote1,
  vote2,
  setVote2,
  availableChoices,
  submitted,
  hasVoted,
  loading,
  error,
  canSubmit,
  submitVote,
  resetForm,
}) {
  if (submitted) {
    return (
      <div className="card success">
        <h2>Thank you for voting!</h2>
        <p className="notice">Thank you. Your vote has been recorded.</p>

        {hasVoted && (
          <p className="notice">
            This device has already voted. Please do not submit again.
          </p>
        )}

        <button className="btn btn-secondary" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <span className="badge">Step 1</span>
      <h2>Select your own group</h2>
      <p className="notice">
        Please choose your own team first. Your own team will be hidden from the voting options.
      </p>

      <div className="grid-4">
        {GROUPS.map((group) => (
          <button
            key={group}
            className={ownGroup === group ? "group-choice selected" : "group-choice"}
            onClick={() => {
              setOwnGroup(group);
              setVote1("");
              setVote2("");
            }}
          >
            {group}
          </button>
        ))}
      </div>

      {ownGroup && (
        <>
          <br />
          <span className="badge">Step 2</span>
          <h2>Cast your two votes</h2>
          <p className="notice">
            You selected <strong>{ownGroup}</strong>. You can vote for other groups or choose Abstain.
          </p>

          <div className="grid-2">
            <VoteSelector
              title="Vote 1"
              value={vote1}
              setValue={setVote1}
              choices={availableChoices}
            />
            <VoteSelector
              title="Vote 2"
              value={vote2}
              setValue={setVote2}
              choices={availableChoices}
            />
          </div>

          {error && <p style={{ color: "#fca5a5" }}>{error}</p>}

          <br />

          <button className="btn btn-green" disabled={!canSubmit} onClick={submitVote}>
            {loading ? "Submitting..." : "Submit"}
          </button>

          <button className="btn btn-secondary" style={{ marginLeft: 12 }} onClick={resetForm}>
            Reset
          </button>
        </>
      )}
    </div>
  );
}

function VoteSelector({ title, value, setValue, choices }) {
  return (
    <div className="vote-box">
      <h3>{title}</h3>

      {choices.map((choice) => (
        <button
          key={choice}
          className={value === choice ? "choice selected-green" : "choice"}
          onClick={() => setValue(choice)}
          style={{ marginBottom: 10 }}
        >
          {choice}
        </button>
      ))}
    </div>
  );
}

function ResultsPage({ votes, results, maxVotes, totalValidVotes, winner, showConfetti }) {
  const highestVotes = Math.max(...Object.values(results));
  const hasAnyVotes = highestVotes > 0;

  return (
    <>
      <div className="result-card-wrap">
        {showConfetti && <PremiumConfetti />}

        <div className="card">
          <span className="badge">Live Result Board</span>
          <h2>Voting Results</h2>

          {GROUPS.map((group) => {
            const count = results[group];
            const width = Math.round((count / maxVotes) * 100);
            const isWinner = hasAnyVotes && count === highestVotes;

            return (
              <div className={isWinner ? "result-row winner-row" : "result-row"} key={group}>
                <div className="result-top">
                  <span className="result-group-name">
                    <span className="group-label">{group}</span>
                    {isWinner && <GoldMedal />}
                  </span>
                  <span>{count}</span>
                </div>

                <div className="bar-bg">
                  <div
                    className={isWinner ? "bar winner-bar" : "bar"}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-box">
          <div className="summary-label">Submissions</div>
          <div className="summary-value">{votes.length}</div>
        </div>

        <div className="summary-box">
          <div className="summary-label">Valid votes</div>
          <div className="summary-value">{totalValidVotes}</div>
        </div>

        <div className="summary-box">
          <div className="summary-label">Winner</div>
          <div className="summary-value">{winner ? winner[0] : "-"}</div>
        </div>
      </div>
    </>
  );
}

function GoldMedal() {
  return (
    <span className="gold-medal" aria-label="Gold medal">
      <span className="medal-ribbon ribbon-left"></span>
      <span className="medal-ribbon ribbon-right"></span>
      <span className="medal-face">
        <span className="medal-shine"></span>
        <span className="medal-number">1</span>
      </span>
    </span>
  );
}

function PremiumConfetti() {
  return (
    <div className="premium-confetti-layer">
      {Array.from({ length: 36 }).map((_, index) => (
        <span
          key={index}
          className={`premium-confetti-piece premium-confetti-piece-${index + 1}`}
        ></span>
      ))}
    </div>
  );
}
