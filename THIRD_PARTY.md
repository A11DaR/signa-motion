# Сторонние материалы и источники

## Распознавание

- Google MediaPipe Tasks Vision 0.10.32, Apache License 2.0. Копия лицензии: `dist/vendor/LICENSE-mediapipe.txt`.
- Дистрибутив: https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/
- Hand Landmarker model: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- Официальная документация: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
- Исходный проект: https://github.com/google-ai-edge/mediapipe

Нейросеть и её веса не обучены командой. Собственная часть — преобразование точек в признаки, правила жестов, временные автоматы, подсказки, сценарий обучения и интерфейс.

## Учебные материалы

ASL University / Dr. Bill Vicars:

- YES: https://www.lifeprint.com/asl101/pages-signs/y/yes.htm — используется кулак и кивок кистью. Встроенный авторский ролик: https://www.youtube.com/watch?v=0usayvOXzHo
- NO: https://www.lifeprint.com/asl101/pages-signs/n/no.htm — есть варианты с одним и несколькими смыканиями. Встроенный авторский ролик: https://www.youtube.com/watch?v=QJXKaOSyl4o
- I LOVE YOU: https://www.lifeprint.com/asl101/topics/ily.htm — форма объединяет I, L и Y; это не отдельный знак LOVE со скрещенными руками.
- Иллюстрация ILY загружается с сайта автора только при открытии образца: https://www.lifeprint.com/asl101/images-layout/ily_asl_1024h.gif . На странице автора указано © 2007 Lifeprint.com, адаптация Gallaudet Type Font © 1991 David Rakowski. Она не включена в архив исходников и не лицензируется нами.

Внешние ролики встроены через YouTube, не скачаны и не включены в репозиторий. Условная схема 21 точки в интерфейсе создана для этого проекта; она не заменяет демонстрацию реального жеста.

Материалы использованы для сверки базового урока, но преподаватель/носитель ещё не проверял приложение. Нельзя приписывать ASL University одобрение SIGNA.

## Публикация

GitHub Pages workflow подготовлен по https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages . Отдельное создание публичного GitHub-репозитория и включение Pages требует доступа к аккаунту команды.

## Контрольные фотографии для регрессионных тестов

Фотографии не распространяются в проекте. В `tests/photo-landmarks.json` и `tests/calibration-palm.json` сохранены только численные результаты HandLandmarker, URL и SHA-256 исходников и модели.

- ILY: https://www.lifeprint.com/asl101/images-signs/i_love_you.jpg
- ILY: https://images.squarespace-cdn.com/content/v1/5b88676fcef37262b9ba64ea/1664413751184-W3XPG6E5XSHI5ZM6Y182/ily.jpg?format=1500w
- Другие формы кисти: публичные `fist.jpg`, `thumb_up.jpg`, `victory.jpg`, `pointing_up.jpg`, `right_hands.jpg`, `left_hands.jpg` из https://storage.googleapis.com/mediapipe-assets/ . Полные ссылки находятся в данных теста.
- Открытая ладонь для калибровки: https://2012books.lardbucket.org/books/a-primer-on-communication-studies/section_04/3c92e0c160680ad6336448ec81f000ad.jpg

Эта небольшая выборка служит проверке конкретных ошибок геометрии, а не заявлению об общей точности распознавания.

Для динамических жестов в `tests/motion-landmarks.json` сохранены только численные результаты той же модели, ссылки и SHA-256. Учебные изображения и анимация ASL University / Dr. Bill Vicars в проект не включены:

- YES: https://www.lifeprint.com/asl101/signjpegs/y/yes1.jpg, https://www.lifeprint.com/asl101/signjpegs/y/yes2.jpg, https://www.lifeprint.com/asl101/signjpegs/y/yes3.jpg, https://www.lifeprint.com/asl101/signjpegs/y/yes4.jpg
- NO: https://www.lifeprint.com/asl101/signjpegs/n/no.htm24.jpg и https://www.lifeprint.com/asl101/signjpegs/n/no.htm25.jpg
- Четырёхкадровый учебный NO: https://www.lifeprint.com/asl101/gifs/n/no-2-movement.gif

Проверены исходные и горизонтально отражённые варианты. Для фотографий использован IMAGE-режим MediaPipe, для последовательности GIF — VIDEO с исходными временными отметками. Это проверка геометрии и переходов по учебным образцам, не испытание непрерывного распознавания на людях.
