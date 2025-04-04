import { useEffect, useRef } from 'react';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';

const KaTeXRender = ({ latex }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      renderMathInElement(ref.current, {
        delimiters: [
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\begin{array}", right: "\\end{array}", display: true },
          { left: "\\begin{bmatrix}", right: "\\end{bmatrix}", display: true }
        ],
        throwOnError: false,
        output: 'html'
      });
    }
  }, [latex]);

  return (
    <div className="katex-content" ref={ref}>
      {latex}
    </div>
  );
};

export default KaTeXRender