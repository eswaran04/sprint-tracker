import type { ReviewProblem } from "@/lib/review/schema";

/**
 * Hand-labelled note reviews used to measure agreement of the note reviewer (`reviewNote`).
 *
 * DRAFT LABELS — written by the tooling author, not yet checked by a second reviewer. Before trusting the
 * agreement numbers, have someone confirm `time`, `space` and `edgeCases` for each item (set `reviewed: true`).
 *
 * `edgeCases` lists the issues a good reviewer must flag. Each is matched by severity plus any keyword in the
 * finding's message. `clean: true` means nothing should be flagged as a bug or risk.
 */
export interface GoldenReview {
  id: string;
  problem: ReviewProblem;
  notes: string;
  expected: {
    time: string;
    space: string;
    verdict: "optimal" | "suboptimal";
    edgeCases: { severity: "bug" | "risk" | "note"; keywords: string[] }[];
    clean?: boolean;
  };
  reviewed: boolean;
}

const p = (name: string, topics: string[], difficulty: ReviewProblem["difficulty"] = "Core"): ReviewProblem => ({
  name,
  url: `https://leetcode.com/problems/${name.toLowerCase().replace(/\s+/g, "-")}/`,
  difficulty,
  subject: "dsa",
  topics,
});

const code = (lang: string, body: string) => `\`\`\`${lang}\n${body.trim()}\n\`\`\``;

export const REVIEW_GOLDEN: GoldenReview[] = [
  {
    id: "two-sum-hash",
    problem: p("Two Sum", ["Arrays", "Hashing"], "Basic"),
    notes: `Hash map of value -> index.\n\n${code("javascript", `
function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}`)}`,
    expected: { time: "O(n)", space: "O(n)", verdict: "optimal", edgeCases: [], clean: true },
    reviewed: false,
  },
  {
    id: "two-sum-brute",
    problem: p("Two Sum", ["Arrays", "Hashing"], "Basic"),
    notes: code("java", `
int[] twoSum(int[] nums, int target) {
    for (int i = 0; i < nums.length; i++) {
        for (int j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] == target) return new int[]{i, j};
        }
    }
    return new int[0];
}`),
    expected: { time: "O(n^2)", space: "O(1)", verdict: "suboptimal", edgeCases: [] },
    reviewed: false,
  },
  {
    id: "binary-search-overflow",
    problem: p("Binary Search", ["Binary Search"], "Basic"),
    notes: code("java", `
int search(int[] nums, int target) {
    int lo = 0, hi = nums.length - 1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
}`),
    expected: { time: "O(log n)", space: "O(1)", verdict: "optimal", edgeCases: [{ severity: "risk", keywords: ["overflow"] }] },
    reviewed: false,
  },
  {
    id: "binary-search-safe-python",
    problem: p("Binary Search", ["Binary Search"], "Basic"),
    notes: code("python", `
def search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`),
    expected: { time: "O(log n)", space: "O(1)", verdict: "optimal", edgeCases: [], clean: true },
    reviewed: false,
  },
  {
    id: "max-subarray-off-by-one",
    problem: p("Maximum Subarray", ["Arrays", "Dynamic Programming"]),
    notes: code("java", `
int maxSubArray(int[] nums) {
    int best = nums[0], cur = 0;
    for (int i = 0; i <= nums.length; i++) {
        cur = Math.max(nums[i], cur + nums[i]);
        best = Math.max(best, cur);
    }
    return best;
}`),
    expected: {
      time: "O(n)", space: "O(1)", verdict: "optimal",
      edgeCases: [{ severity: "bug", keywords: ["off-by-one", "past the last", "<="] }, { severity: "risk", keywords: ["empty"] }],
    },
    reviewed: false,
  },
  {
    id: "adjacent-diff-out-of-bounds",
    problem: p("Monotonic Array", ["Arrays"], "Basic"),
    notes: code("cpp", `
bool isMonotonic(vector<int>& a) {
    bool inc = true, dec = true;
    for (int i = 0; i < a.size(); i++) {
        if (a[i + 1] > a[i]) dec = false;
        if (a[i + 1] < a[i]) inc = false;
    }
    return inc || dec;
}`),
    expected: { time: "O(n)", space: "O(1)", verdict: "optimal", edgeCases: [{ severity: "risk", keywords: ["one past", "length - 1", "a[i + 1]"] }] },
    reviewed: false,
  },
  {
    id: "product-int-overflow",
    problem: p("Maximum Product of Two Elements", ["Arrays", "Sorting"], "Basic"),
    notes: code("java", `
int maxProduct(int[] nums) {
    Arrays.sort(nums);
    int n = nums.length;
    int prod = nums[n - 1] * nums[n - 2];
    return prod;
}`),
    expected: { time: "O(n log n)", space: "O(1)", verdict: "suboptimal", edgeCases: [{ severity: "note", keywords: ["overflow", "long"] }] },
    reviewed: false,
  },
  {
    id: "kth-largest-heap",
    problem: p("Kth Largest Element in an Array", ["Heap", "Sorting"]),
    notes: code("java", `
int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> pq = new PriorityQueue<>();
    for (int x : nums) {
        pq.offer(x);
        if (pq.size() > k) pq.poll();
    }
    return pq.peek();
}`),
    expected: { time: "O(n log k)", space: "O(k)", verdict: "optimal", edgeCases: [], clean: true },
    reviewed: false,
  },
  {
    id: "three-sum-cubic",
    problem: p("3Sum", ["Arrays", "Two Pointers", "Sorting"]),
    notes: code("python", `
def threeSum(nums):
    res = set()
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                if nums[i] + nums[j] + nums[k] == 0:
                    res.add(tuple(sorted((nums[i], nums[j], nums[k]))))
    return [list(t) for t in res]`),
    expected: { time: "O(n^3)", space: "O(n)", verdict: "suboptimal", edgeCases: [] },
    reviewed: false,
  },
  {
    id: "three-sum-two-pointers",
    problem: p("3Sum", ["Arrays", "Two Pointers", "Sorting"]),
    notes: code("python", `
def threeSum(nums):
    nums.sort()
    res = []
    for i in range(len(nums) - 2):
        if i and nums[i] == nums[i - 1]:
            continue
        l, r = i + 1, len(nums) - 1
        while l < r:
            s = nums[i] + nums[l] + nums[r]
            if s < 0:
                l += 1
            elif s > 0:
                r -= 1
            else:
                res.append([nums[i], nums[l], nums[r]])
                l += 1
                while l < r and nums[l] == nums[l - 1]:
                    l += 1
    return res`),
    expected: { time: "O(n^2)", space: "O(1)", verdict: "optimal", edgeCases: [], clean: true },
    reviewed: false,
  },
  {
    id: "climbing-stairs-dp",
    problem: p("Climbing Stairs", ["Dynamic Programming"], "Basic"),
    notes: `Time: O(n), Space: O(n)\n\n${code("python", `
def climbStairs(n):
    dp = [0] * (n + 1)
    dp[0] = dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]`)}`,
    expected: { time: "O(n)", space: "O(n)", verdict: "suboptimal", edgeCases: [] },
    reviewed: false,
  },
  {
    id: "first-element-no-guard",
    problem: p("Running Sum of 1d Array", ["Arrays", "Prefix Sum"], "Basic"),
    notes: code("java", `
int[] runningSum(int[] nums) {
    int[] out = new int[nums.length];
    out[0] = nums[0];
    for (int i = 1; i < nums.length; i++) out[i] = out[i - 1] + nums[i];
    return out;
}`),
    expected: { time: "O(n)", space: "O(n)", verdict: "optimal", edgeCases: [{ severity: "risk", keywords: ["empty"] }] },
    reviewed: false,
  },
  {
    id: "prose-only",
    problem: p("Valid Parentheses", ["Stack", "Strings"], "Basic"),
    notes: "Push opening brackets on a stack and pop on a closing one; the string is valid if the stack ends empty.\n\nTime: O(n)\nSpace: O(n)",
    expected: { time: "O(n)", space: "O(n)", verdict: "optimal", edgeCases: [] },
    reviewed: false,
  },
  {
    id: "contains-duplicate-set",
    problem: p("Contains Duplicate", ["Arrays", "Hashing"], "Basic"),
    notes: code("python", `
def containsDuplicate(nums):
    seen = set()
    for x in nums:
        if x in seen:
            return True
        seen.add(x)
    return False`),
    expected: { time: "O(n)", space: "O(n)", verdict: "optimal", edgeCases: [], clean: true },
    reviewed: false,
  },
  {
    id: "matrix-search-quadratic",
    problem: p("Search a 2D Matrix", ["Binary Search", "Matrix"]),
    notes: code("java", `
boolean searchMatrix(int[][] m, int target) {
    for (int i = 0; i < m.length; i++) {
        for (int j = 0; j < m[0].length; j++) {
            if (m[i][j] == target) return true;
        }
    }
    return false;
}`),
    expected: { time: "O(n^2)", space: "O(1)", verdict: "suboptimal", edgeCases: [{ severity: "risk", keywords: ["empty"] }] },
    reviewed: false,
  },
  {
    id: "sliding-window-js",
    problem: p("Longest Substring Without Repeating Characters", ["Strings", "Sliding Window"]),
    notes: code("javascript", `
function lengthOfLongestSubstring(s) {
  const last = new Map();
  let best = 0, left = 0;
  for (let right = 0; right < s.length; right++) {
    if (last.has(s[right]) && last.get(s[right]) >= left) left = last.get(s[right]) + 1;
    last.set(s[right], right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}`),
    expected: { time: "O(n)", space: "O(n)", verdict: "optimal", edgeCases: [], clean: true },
    reviewed: false,
  },
];
