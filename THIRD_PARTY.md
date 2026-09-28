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
