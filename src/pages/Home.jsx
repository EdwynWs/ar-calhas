import { Button } from "../components/Common";
export default function Home({ go }) {
  return (
    <div className="home-actions" aria-label="O que você quer fazer?">
      <Button
        variant="home-action receive"
        onClick={() => go({ page: "money-form", type: "income" })}
      >
        Recebi dinheiro
      </Button>
      <Button
        variant="home-action spend"
        onClick={() => go({ page: "money-form", type: "expense" })}
      >
        Gastei dinheiro
      </Button>
      <Button
        variant="home-action quote"
        onClick={() => go({ page: "quote-form" })}
      >
        Fazer orçamento
      </Button>
    </div>
  );
}
