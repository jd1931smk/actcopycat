document.addEventListener('DOMContentLoaded', async () => {
    const testNumberSelect = document.getElementById('testNumberSelect');
    const questionNumberSelect = document.getElementById('questionNumberSelect');

    // Fetch Test Numbers on page load
    const testResponse = await fetch('/api/getTestNumbers');
    const testNumbers = await testResponse.json();
    testNumbers.forEach(tn => {
        const option = document.createElement('option');
        option.value = tn;
        option.text = tn;
        testNumberSelect.appendChild(option);
    });

    // Update Question Numbers when Test Number changes
    testNumberSelect.addEventListener('change', async () => {
        const selectedTestNumber = testNumberSelect.value;
        questionNumberSelect.innerHTML = '<option value="">Select a Question Number</option>';
        questionNumberSelect.disabled = true;

        if (selectedTestNumber) {
            const qnResponse = await fetch(`/api/getQuestionNumbers?testNumber=${encodeURIComponent(selectedTestNumber)}`);
            const questionNumbers = await qnResponse.json();
            questionNumbers.forEach(qn => {
                const option = document.createElement('option');
                option.value = qn;
                option.text = qn;
                questionNumberSelect.appendChild(option);
            });
            questionNumberSelect.disabled = false;
        }
    });

    // Display question details and clones when Question Number changes
    questionNumberSelect.addEventListener('change', async () => {
        const selectedTestNumber = testNumberSelect.value;
        const selectedQuestionNumber = questionNumberSelect.value;

        if (selectedTestNumber && selectedQuestionNumber) {
            // Fetch and display original question
            const detailsResponse = await fetch(`/api/getQuestionDetails?testNumber=${encodeURIComponent(selectedTestNumber)}&questionNumber=${selectedQuestionNumber}`);
            const questionDetails = await detailsResponse.json();

            const photoDiv = document.getElementById('photo');
            photoDiv.innerHTML = '';
            if (questionDetails.photo && questionDetails.photo.length > 0) {
                const img = document.createElement('img');
                img.src = questionDetails.photo[0].url;
                img.style.maxWidth = '500px'; // Optional: adjust size
                photoDiv.appendChild(img);
            }

            const latexDiv = document.getElementById('latex');
            latexDiv.innerHTML = '$$' + (questionDetails.latex || '') + '$$';

            // Fetch and display clone questions
            const cloneResponse = await fetch(`/api/getCloneQuestions?questionId=${questionDetails.id}`);
            const clones = await cloneResponse.json();
            const clonesDiv = document.getElementById('clones');
            clonesDiv.innerHTML = '';
            if (clones.length > 0) {
                clones.forEach(cloneLM => {
                    const div = document.createElement('div');
                    div.innerHTML = '$$' + (cloneLM || '') + '$$';
                    clonesDiv.appendChild(div);
                });
            } else {
                clonesDiv.innerHTML = '<p>No clone questions found.</p>';
            }

            // Render LaTeX with MathJax
            MathJax.typesetPromise();
        }
    });
});