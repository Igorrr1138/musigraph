import { describe, it, expect } from "vitest";
import { parseReleaseFromWiki } from "./lastfm";

describe("parseReleaseFromWiki", () => {
  it("returns null for undefined / empty input", () => {
    expect(parseReleaseFromWiki(undefined)).toBeNull();
    expect(parseReleaseFromWiki("")).toBeNull();
    expect(parseReleaseFromWiki("   \n  ")).toBeNull();
  });

  it("returns null when no release phrase is present", () => {
    expect(
      parseReleaseFromWiki(
        "Ride the Lightning is the second studio album by Metallica.",
      ),
    ).toBeNull();
  });

  describe("month-first dates", () => {
    it('parses "released on July 27, 1984"', () => {
      expect(
        parseReleaseFromWiki(
          '"Ride the Lightning" is the second studio album by Metallica, released on July 27, 1984, by Megaforce Records.',
        ),
      ).toBe("1984-07-27");
    });

    it('parses "released July 27, 1984" (no "on")', () => {
      expect(
        parseReleaseFromWiki("The album was released July 27, 1984 in the US."),
      ).toBe("1984-07-27");
    });

    it("parses abbreviated month names", () => {
      expect(
        parseReleaseFromWiki("Released on Jul 27, 1984 by Megaforce."),
      ).toBe("1984-07-27");
    });

    it("pads single-digit days", () => {
      expect(
        parseReleaseFromWiki("Released on March 3, 1986 by Elektra Records."),
      ).toBe("1986-03-03");
    });

    it("is case-insensitive on the trigger word", () => {
      expect(
        parseReleaseFromWiki("RELEASED ON August 12, 1991."),
      ).toBe("1991-08-12");
    });
  });

  describe("day-first dates", () => {
    it('parses "released on 27 July 1984"', () => {
      expect(
        parseReleaseFromWiki("It was released on 27 July 1984."),
      ).toBe("1984-07-27");
    });

    it('parses "released 3 March 1986" (no "on")', () => {
      expect(
        parseReleaseFromWiki("Master of Puppets was released 3 March 1986."),
      ).toBe("1986-03-03");
    });
  });

  describe("year-only fallback", () => {
    it('parses "released in 1984"', () => {
      expect(
        parseReleaseFromWiki("The album was released in 1984 to acclaim."),
      ).toBe("1984-01-01");
    });

    it('parses "released 1984" (no preposition)', () => {
      expect(parseReleaseFromWiki("Released 1984, produced by X.")).toBe(
        "1984-01-01",
      );
    });
  });

  describe("precedence", () => {
    it("prefers the full month-first date over a later bare year", () => {
      const text =
        "Released on July 27, 1984 by Megaforce Records. Remastered in 2016.";
      expect(parseReleaseFromWiki(text)).toBe("1984-07-27");
    });

    it("prefers the full day-first date over a bare year mention", () => {
      const text = "Released on 3 March 1986. Reissued in 2017.";
      expect(parseReleaseFromWiki(text)).toBe("1986-03-03");
    });
  });

  describe("regression: Deezer remaster-year bug", () => {
    it("extracts 1984 for Ride the Lightning (Deezer reports 2016)", () => {
      const summary =
        '"Ride the Lightning" is the second studio album by the American heavy metal band Metallica, released on July 27, 1984, by Megaforce Records. The album was recorded over a three-week period.';
      expect(parseReleaseFromWiki(summary)).toBe("1984-07-27");
    });

    it("extracts 1983 for Kill 'Em All", () => {
      const summary =
        "Kill 'Em All is the debut studio album by American heavy metal band Metallica, released on July 25, 1983, by independent record label Megaforce Records.";
      expect(parseReleaseFromWiki(summary)).toBe("1983-07-25");
    });
  });
});
