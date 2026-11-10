export const LINKS = {
  github: "https://github.com/TinomutendaN",
  portfolio: "https://portfolio-nine-phi-19.vercel.app/",
} as const;

export type DemoVideo = {
  /** Path in web/public. Set to "/demo.mp4" once the file is added. */
  src: string | null;
  /** Optional poster frame in web/public; null shows the video's first frame. */
  poster: string | null;
  duration: string;
};

export const DEMO_VIDEO: DemoVideo = {
  src: null,
  poster: null,
  duration: "1:00",
};

export const HEADLINE = "Ask your company’s documents. See the source for every answer.";

export const SUBLINE =
  "Staff get answers from HR policies, contracts and patient materials, with the exact passage shown. " +
  "Loaded with sample documents from a fictional healthcare company, so you can try it right away.";
