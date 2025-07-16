import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Calendar, User } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface Article {
  id?: number;
  _id?: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  author: string;
  createdAt: string;
  published: boolean;
}

export default function Articles() {
  const [showAll, setShowAll] = useState(false);

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/articles");
      return response.json();
    },
    placeholderData: [],
  });

  // Show only first 6 articles initially, or all if showAll is true
  const displayedArticles = showAll ? articles : articles.slice(0, 6);

  // Helper function to get article ID (handles both MongoDB _id and PostgreSQL id)
  const getArticleId = (article: Article) => {
    return article.id || article._id;
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <section id="articles" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-48 mx-auto mb-4" />
            <Skeleton className="h-1 w-20 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-32" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section id="articles" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 font-serif">
            Artikel Terbaru
          </h2>
          <div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">
            Berita dan informasi terkini dari HIMATIF ENCODER
          </p>
        </div>

        {/* Articles Grid */}
        {articles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              Belum ada artikel yang dipublikasikan
            </div>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
              {displayedArticles.map((article) => (
                <Card
                  key={getArticleId(article)}
                  className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group"
                >
                  {/* Article Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder-article.jpg";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  {/* Article Content */}
                  <CardHeader className="pb-3">
                    <h3 className="font-bold text-xl leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{article.author}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(article.createdAt)}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <p className="text-gray-600 leading-relaxed">
                      {truncateText(article.excerpt)}
                    </p>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <Link href={`/artikel/${getArticleId(article)}`}>
                      <Button
                        variant="link"
                        className="text-primary hover:text-primary/80 p-0 h-auto font-medium"
                      >
                        Baca selengkapnya →
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
            {/* Show More/Less Button */}
            {articles.length > 6 && (
              <div className="text-center mt-12">
                <Button
                  onClick={() => setShowAll(!showAll)}
                  variant="outline"
                  className="px-8 py-2"
                >
                  {showAll ? "Tampilkan Lebih Sedikit" : "Lihat Semua Artikel"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
